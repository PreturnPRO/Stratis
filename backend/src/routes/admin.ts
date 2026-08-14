import { Router } from "express";
import type { FeedbackRecord } from "@shared/types";
import {
  isPlatformOperator,
  requireAuth,
  requireFacilitator,
  requirePlatformAdmin,
} from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { generatePlanCode, isGrantablePlan, normalisePlanCode } from "../lib/planCodes";
import { operatorUsage, usageByDay } from "../lib/rollups";
import { invalidateOrg, invalidateReleaseCutoff } from "../lib/accountState";
import { track } from "../lib/analytics";

export const adminRouter = Router();

/**
 * This file holds two kinds of route and they must never be confused:
 *
 * - **Own workspace** (`requireFacilitator`) — scoped by `req.auth.orgId`. What
 *   is left of it is feedback and the plan request: a facilitator's own
 *   container, which no screen names and no screen manages.
 * - **Platform** (`requirePlatformAdmin`) — the Stratis team. Crosses
 *   workspaces, so it is gated on the email allowlist, never on a role.
 *
 * There is deliberately no blanket `.use()` guard: a router-wide role check is
 * what once left `POST /release` — a product-wide logout switch — reachable by
 * anyone who ticked "admin" at signup. Every route states its own guard, and
 * `adminGuards.test.ts` fails the build if one does not.
 */
adminRouter.use(requireAuth);

adminRouter.get("/feedback", requireFacilitator, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const params: unknown[] = [req.auth!.orgId];
    let where = "f.org_id = $1";
    if (status && ["new", "triaged", "resolved", "wontfix"].includes(status)) {
      params.push(status);
      where += ` AND f.status = $${params.length}`;
    }

    const result = await db.query(
      `SELECT f.*, u.name AS user_name
       FROM feedback f LEFT JOIN users u ON u.id = f.user_id
       WHERE ${where}
       ORDER BY f.created_at DESC LIMIT 200`,
      params,
    );

    const items: FeedbackRecord[] = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      orgId: row.org_id as string | null,
      userId: row.user_id as string | null,
      userName: (row.user_name as string | null) ?? null,
      sessionId: row.session_id as string | null,
      kind: row.kind as FeedbackRecord["kind"],
      rating: row.rating as number | null,
      message: row.message as string,
      surface: row.surface as string | null,
      appVersion: row.app_version as string | null,
      status: row.status as FeedbackRecord["status"],
      createdAt: row.created_at as string,
    }));

    res.json({ ok: true, data: { feedback: items } });
  } catch (error) {
    console.error("Admin feedback error:", error);
    res.status(500).json({ ok: false, error: "Could not load feedback" });
  }
});

adminRouter.patch("/feedback/:id", requireFacilitator, async (req, res) => {
  try {
    const status = req.body?.status;
    if (!["new", "triaged", "resolved", "wontfix"].includes(status)) {
      return res.status(400).json({ ok: false, error: "Unknown status" });
    }
    const result = await db.query(
      `UPDATE feedback SET status = $1 WHERE id = $2 AND org_id = $3 RETURNING id`,
      [status, req.params.id, req.auth!.orgId],
    );
    if (result.rows.length === 0) return res.status(404).json({ ok: false, error: "Feedback not found" });
    res.json({ ok: true, data: { updated: true } });
  } catch (error) {
    console.error("Admin feedback update error:", error);
    res.status(500).json({ ok: false, error: "Could not update that feedback" });
  }
});

/**
 * Publish a release. With forceLogout, every token issued before this instant
 * stops working — which is how a deploy clears clients still running the old
 * bundle instead of letting them talk to an API that moved.
 *
 * The cutoff is global — `app_releases` has no org column and `getReleaseCutoff`
 * reads the newest row for the whole product — so this is an operator action,
 * not a workspace one. Behind `requireRole("admin")` alone it was reachable by
 * anyone at all: signup accepts a self-declared role, so thirty seconds of
 * account creation bought the ability to sign out every user in every
 * workspace and drop every live meeting's WebSocket, on repeat.
 */
adminRouter.post("/release", requirePlatformAdmin, async (req, res) => {
  try {
    const version = typeof req.body?.version === "string" ? req.body.version.trim() : "";
    if (!version) return res.status(400).json({ ok: false, error: "version is required" });

    const forceLogout = req.body?.forceLogout !== false;
    const id = newId("rel");

    await db.query(
      `INSERT INTO app_releases (id, version, notes, force_logout, released_by, released_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        version.slice(0, 40),
        typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 1000) || null : null,
        forceLogout,
        req.auth!.sub,
        now(),
      ],
    );
    invalidateReleaseCutoff();

    res.status(201).json({ ok: true, data: { id, version, forceLogout } });
  } catch (error) {
    console.error("Admin release error:", error);
    res.status(500).json({ ok: false, error: "Could not publish that release" });
  }
});

adminRouter.get("/plan-requests", requireFacilitator, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pr.*, u.name AS requested_by_name
       FROM plan_requests pr LEFT JOIN users u ON u.id = pr.requested_by
       WHERE pr.org_id = $1 ORDER BY pr.created_at DESC LIMIT 50`,
      [req.auth!.orgId],
    );
    res.json({ ok: true, data: { requests: result.rows } });
  } catch (error) {
    console.error("Admin plan requests error:", error);
    res.status(500).json({ ok: false, error: "Could not load plan requests" });
  }
});

/**
 * Issue a beta access code.
 *
 * Platform operators only. The grant is worth money, and a workspace admin is
 * whoever ticked "admin" at signup — so issuing and redeeming are deliberately
 * different powers held by different people.
 */
adminRouter.post("/plan-codes", requirePlatformAdmin, async (req, res) => {
  try {
    const plan = req.body?.plan;
    if (!isGrantablePlan(plan)) {
      return res.status(400).json({ ok: false, error: "A code may grant pro or beta" });
    }

    const label = typeof req.body?.label === "string" ? req.body.label.trim().slice(0, 80) : null;
    const grantDays =
      Number.isFinite(Number(req.body?.grantDays)) && Number(req.body?.grantDays) > 0
        ? Math.floor(Number(req.body.grantDays))
        : null;
    const maxUses =
      Number.isFinite(Number(req.body?.maxUses)) && Number(req.body?.maxUses) > 0
        ? Math.floor(Number(req.body.maxUses))
        : null;
    const expiresInDays =
      Number.isFinite(Number(req.body?.expiresInDays)) && Number(req.body?.expiresInDays) > 0
        ? Math.floor(Number(req.body.expiresInDays))
        : null;

    const code = generatePlanCode();
    const id = newId("pcode");
    const ts = now();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
      : null;

    await db.query(
      `INSERT INTO plan_codes (id, code, plan, label, grant_days, expires_at, max_uses, used_count, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9)`,
      [id, normalisePlanCode(code), plan, label, grantDays, expiresAt, maxUses, req.auth!.sub, ts],
    );

    // The dashed form is what a human reads out; the stored form is normalised.
    res.json({ ok: true, data: { id, code, plan, label, grantDays, maxUses, expiresAt } });
  } catch (error) {
    console.error("Plan code create error:", error);
    res.status(500).json({ ok: false, error: "Could not create the code" });
  }
});

/** Every code and what it has been used for. Platform operators only. */
adminRouter.get("/plan-codes", requirePlatformAdmin, async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.code, c.plan, c.label, c.grant_days, c.expires_at, c.max_uses,
              c.used_count, c.revoked_at, c.created_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'orgId', r.org_id,
                    'orgName', o.name,
                    -- Who typed the code in. The operator needs a person to
                    -- write to when a beta grant is ending, and an org id is
                    -- not somebody you can email.
                    'email', u.email,
                    'name', u.name,
                    'redeemedAt', r.redeemed_at,
                    'grantedUntil', r.granted_until,
                    -- Whether the grant is still standing, as opposed to
                    -- whether the code is still redeemable. Two different
                    -- things, and the console shows both.
                    'active', (o.plan <> 'free' AND o.plan_status = 'active')
                  )
                  ORDER BY r.redeemed_at DESC
                ) FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) AS redemptions
       FROM plan_codes c
       LEFT JOIN plan_code_redemptions r ON r.code_id = c.id
       LEFT JOIN organizations o ON o.id = r.org_id
       LEFT JOIN users u ON u.id = r.redeemed_by
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT 100`,
    );
    res.json({ ok: true, data: { codes: result.rows } });
  } catch (error) {
    console.error("Plan code list error:", error);
    res.status(500).json({ ok: false, error: "Could not load the codes" });
  }
});

/**
 * "Am I an operator?" — one request instead of a guess.
 *
 * Deliberately behind `requireAuth` rather than `requirePlatformAdmin`, because
 * a 403 cannot tell you whether the allowlist is empty, missing your address,
 * or not deployed at all. This answers plainly, and says nothing an account
 * cannot already see about itself.
 */
adminRouter.get("/whoami", requireFacilitator, async (req, res) => {
  try {
    const result = await db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [
      req.auth!.sub,
    ]);
    const email = result.rows[0]?.email ?? null;
    const configured = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean).length;

    res.json({
      ok: true,
      data: {
        email,
        platformAdmin: isPlatformOperator(email),
        /** How many addresses the deploy has. Zero means the variable is unset. */
        allowlistSize: configured,
      },
    });
  } catch (error) {
    console.error("whoami error:", error);
    res.status(500).json({ ok: false, error: "Could not check your access" });
  }
});

/**
 * Every workspace's usage, for the Stratis team.
 *
 * Read entirely from `session_rollups`, which is written once when a meeting
 * ends. Nothing here queries a session, a transcript or a card, so an operator
 * refreshing during a launch cannot compete with the meetings being recorded.
 * It is also why the numbers move when a meeting *finishes*, not while it runs.
 */
adminRouter.get("/usage", requirePlatformAdmin, async (req, res) => {
  try {
    const asked = Number(req.query.days);
    const days = Number.isFinite(asked) && asked > 0 && asked <= 365 ? Math.floor(asked) : 30;
    const [workspaces, byDay] = await Promise.all([operatorUsage(days), usageByDay(days)]);

    const totals = workspaces.reduce(
      (acc, w) => ({
        meetings: acc.meetings + w.meetings,
        recordedMinutes: acc.recordedMinutes + w.recordedMinutes,
        decisions: acc.decisions + w.decisions,
        activeWorkspaces: acc.activeWorkspaces + (w.meetings > 0 ? 1 : 0),
      }),
      { meetings: 0, recordedMinutes: 0, decisions: 0, activeWorkspaces: 0 },
    );

    res.json({ ok: true, data: { days, totals, workspaces, byDay } });
  } catch (error) {
    console.error("Operator usage error:", error);
    res.status(500).json({ ok: false, error: "Could not load usage" });
  }
});

/**
 * Take back a grant a code already made.
 *
 * Revoking the *code* stops the next workspace redeeming it; it deliberately
 * leaves standing grants alone, because withdrawing a plan from a team
 * mid-meeting is not something a typo should be able to do. This is the
 * explicit second action: name the workspace, and its plan goes back to free.
 *
 * The redemption row stays. It is the audit trail for a plan someone will ask
 * about later, and deleting it would make the grant look like it never
 * happened.
 */
adminRouter.post("/plan-codes/:id/redemptions/:orgId/revoke", requirePlatformAdmin, async (req, res) => {
  try {
    const redemption = await db.query<{ org_id: string }>(
      `SELECT org_id FROM plan_code_redemptions WHERE code_id = $1 AND org_id = $2`,
      [req.params.id, req.params.orgId],
    );
    if (redemption.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "That workspace did not redeem this code" });
    }

    await db.query(
      `UPDATE organizations
       SET plan = 'free', plan_status = 'active', plan_expires_at = $1, plan_note = $2
       WHERE id = $3`,
      [now(), "Beta grant withdrawn by the Stratis team", req.params.orgId],
    );
    invalidateOrg(req.params.orgId);

    track({
      event: "plan_grant_revoked",
      orgId: req.params.orgId,
      userId: req.auth!.sub,
      props: { codeId: req.params.id },
    });

    res.json({ ok: true, data: { orgId: req.params.orgId, plan: "free" } });
  } catch (error) {
    console.error("Plan grant revoke error:", error);
    res.status(500).json({ ok: false, error: "Could not withdraw that grant" });
  }
});

/** Stop a code being redeemed again. Grants already made are left alone. */
adminRouter.post("/plan-codes/:id/revoke", requirePlatformAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE plan_codes SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL RETURNING id`,
      [now(), req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "No such code, or it is already revoked" });
    }
    res.json({ ok: true, data: { id: req.params.id } });
  } catch (error) {
    console.error("Plan code revoke error:", error);
    res.status(500).json({ ok: false, error: "Could not revoke the code" });
  }
});
