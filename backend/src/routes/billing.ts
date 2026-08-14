import { Router } from "express";
import type { OrgPlanState, PlanRequest, SubscriptionView } from "@shared/types";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { PLANS, effectivePlan, getPlan, isPlanId } from "../lib/plans";
import {
  checkPlanCode,
  grantExpiry,
  normalisePlanCode,
  type PlanCodeRow,
} from "../lib/planCodes";
import { getUsage } from "../lib/entitlements";
import { invalidateOrg } from "../lib/accountState";
import { track } from "../lib/analytics";

export const billingRouter = Router();

interface OrgRow {
  id: string;
  name: string;
  plan: string;
  plan_status: string;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  plan_note: string | null;
  is_beta: boolean;
}

interface PlanRequestRow {
  id: string;
  org_id: string;
  requested_by: string | null;
  from_plan: string;
  to_plan: string;
  billing_period: "monthly" | "yearly";
  note: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  created_at: string;
}

function toPlanRequest(row: PlanRequestRow): PlanRequest {
  return {
    id: row.id,
    orgId: row.org_id,
    requestedBy: row.requested_by,
    fromPlan: getPlan(row.from_plan).id,
    toPlan: getPlan(row.to_plan).id,
    billingPeriod: row.billing_period,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

/** The public catalog. Internal tiers (beta) are never advertised. */
billingRouter.get("/plans", (_req, res) => {
  res.json({
    ok: true,
    data: { plans: Object.values(PLANS).filter((plan) => !plan.internal) },
  });
});

billingRouter.get("/subscription", requireAuth, async (req, res) => {
  try {
    const orgResult = await db.query<OrgRow>(`SELECT * FROM organizations WHERE id = $1`, [
      req.auth!.orgId,
    ]);
    const org = orgResult.rows[0];
    if (!org) return res.status(404).json({ ok: false, error: "Workspace not found" });

    const plan = effectivePlan(org.plan, org.plan_status, org.plan_expires_at);
    const usage = await getUsage(org.id);

    const pending = await db.query<PlanRequestRow>(
      `SELECT * FROM plan_requests WHERE org_id = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [org.id],
    );

    const state: OrgPlanState = {
      orgId: org.id,
      plan: getPlan(org.plan).id,
      status: (org.plan_status ?? "active") as OrgPlanState["status"],
      isBeta: Boolean(org.is_beta),
      startedAt: org.plan_started_at,
      expiresAt: org.plan_expires_at,
      note: org.plan_note,
    };

    const view: SubscriptionView = {
      plan,
      state,
      usage,
      limits: plan.limits,
      features: plan.features,
      pendingRequest: pending.rows[0] ? toPlanRequest(pending.rows[0]) : null,
    };

    res.json({ ok: true, data: view });
  } catch (error) {
    console.error("Subscription read error:", error);
    res.status(500).json({ ok: false, error: "Could not load your plan" });
  }
});

/**
 * Beta has no payment gateway, so "upgrade" records intent and an operator
 * fulfils it. That keeps demand measurable — and keeps the app from implying a
 * charge it cannot take.
 */
billingRouter.post("/request", requireAuth, requireRole("facilitator"), async (req, res) => {
  try {
    const toPlan = req.body?.plan;
    if (!isPlanId(toPlan) || PLANS[toPlan].internal) {
      return res.status(400).json({ ok: false, error: "Choose a valid plan" });
    }

    const billingPeriod = req.body?.billingPeriod === "yearly" ? "yearly" : "monthly";

    const orgResult = await db.query<OrgRow>(`SELECT * FROM organizations WHERE id = $1`, [
      req.auth!.orgId,
    ]);
    const org = orgResult.rows[0];
    if (!org) return res.status(404).json({ ok: false, error: "Workspace not found" });
    if (org.plan === toPlan) {
      return res.status(409).json({ ok: false, error: `This workspace is already on ${PLANS[toPlan].name}` });
    }

    const existing = await db.query(
      `SELECT id FROM plan_requests WHERE org_id = $1 AND status = 'pending'`,
      [org.id],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, error: "There is already a request waiting on this workspace" });
    }

    const id = newId("plreq");
    await db.query(
      `INSERT INTO plan_requests (id, org_id, requested_by, from_plan, to_plan, billing_period, note, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
      [
        id,
        org.id,
        req.auth!.sub,
        org.plan,
        toPlan,
        billingPeriod,
        typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) || null : null,
        now(),
      ],
    );

    track({
      event: "upgrade_clicked",
      orgId: org.id,
      userId: req.auth!.sub,
      props: { from: org.plan, to: toPlan, billingPeriod },
    });

    const created = await db.query<PlanRequestRow>(`SELECT * FROM plan_requests WHERE id = $1`, [id]);
    res.status(201).json({ ok: true, data: { request: toPlanRequest(created.rows[0]) } });
  } catch (error) {
    console.error("Plan request error:", error);
    res.status(500).json({ ok: false, error: "Could not record that request" });
  }
});

/**
 * Assign a plan directly. Workspace admins can only downgrade themselves —
 * granting a paid tier is an operator action, or anyone could self-upgrade.
 */
billingRouter.post("/assign", requireAuth, requireRole("facilitator"), async (req, res) => {
  try {
    const plan = req.body?.plan;
    if (!isPlanId(plan)) return res.status(400).json({ ok: false, error: "Unknown plan" });
    if (plan !== "free") {
      return res.status(403).json({
        ok: false,
        error: "Only the Stratis team can activate a paid plan during beta. Request an upgrade instead.",
      });
    }

    await db.query(
      `UPDATE organizations SET plan = $1, plan_status = 'active', plan_started_at = $2, plan_expires_at = NULL
       WHERE id = $3`,
      [plan, now(), req.auth!.orgId],
    );
    invalidateOrg(req.auth!.orgId);

    res.json({ ok: true, data: { plan } });
  } catch (error) {
    console.error("Plan assign error:", error);
    res.status(500).json({ ok: false, error: "Could not change the plan" });
  }
});

/**
 * Redeem a beta access code.
 *
 * The workspace admin's half of the bypass: they cannot grant themselves a
 * plan, only redeem one that a platform operator issued. Everything the grant
 * depends on — the plan, how long it lasts, how many workspaces may use it —
 * is decided when the code is created, not here.
 */
billingRouter.post("/redeem", requireAuth, requireRole("facilitator"), async (req, res) => {
  try {
    const raw = typeof req.body?.code === "string" ? req.body.code : "";
    if (!raw.trim()) return res.status(400).json({ ok: false, error: "Enter the code you were given" });

    const code = normalisePlanCode(raw);

    // One transaction, row locked: two admins pasting the same code at once
    // must not both pass a max_uses check that neither has incremented yet.
    const outcome = await db.tx(async (client) => {
      const found = await client.query<PlanCodeRow>(
        `SELECT id, code, plan, label, grant_days, expires_at, max_uses, used_count, revoked_at
         FROM plan_codes WHERE code = $1 FOR UPDATE`,
        [code],
      );

      const check = checkPlanCode(found.rows[0]);
      if (!check.ok) return { ok: false as const, status: 404, error: check.reason };

      const row = check.row;

      const already = await client.query(
        `SELECT id FROM plan_code_redemptions WHERE code_id = $1 AND org_id = $2`,
        [row.id, req.auth!.orgId],
      );
      if (already.rows.length > 0) {
        return { ok: false as const, status: 409, error: "This workspace has already used that code" };
      }

      const ts = now();
      const grantedUntil = grantExpiry(row.grant_days);

      await client.query(
        `UPDATE organizations
         SET plan = $1, plan_status = 'active', plan_started_at = $2, plan_expires_at = $3,
             is_beta = $4, plan_note = $5
         WHERE id = $6`,
        [row.plan, ts, grantedUntil, row.plan === "beta", row.label, req.auth!.orgId],
      );

      await client.query(
        `INSERT INTO plan_code_redemptions
           (id, code_id, org_id, redeemed_by, granted_plan, granted_until, redeemed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [newId("pcuse"), row.id, req.auth!.orgId, req.auth!.sub, row.plan, grantedUntil, ts],
      );

      await client.query(`UPDATE plan_codes SET used_count = used_count + 1 WHERE id = $1`, [row.id]);

      return { ok: true as const, plan: row.plan, grantedUntil, label: row.label };
    });

    if (!outcome.ok) return res.status(outcome.status).json({ ok: false, error: outcome.error });

    invalidateOrg(req.auth!.orgId);
    track({
      event: "plan_code_redeemed",
      orgId: req.auth!.orgId,
      userId: req.auth!.sub,
      props: { plan: outcome.plan, grantedUntil: outcome.grantedUntil },
    });

    res.json({
      ok: true,
      data: { plan: getPlan(outcome.plan).id, grantedUntil: outcome.grantedUntil, label: outcome.label },
    });
  } catch (error) {
    console.error("Plan code redeem error:", error);
    res.status(500).json({ ok: false, error: "Could not apply that code" });
  }
});
