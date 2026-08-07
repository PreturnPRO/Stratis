import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { AdminUserRow, BetaMetrics, FeedbackRecord, Role } from "@shared/types";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { effectivePlan, getPlan, PLANS } from "../lib/plans";
import { enforceSeatQuota, getUsage } from "../lib/entitlements";
import {
  invalidateAccount,
  invalidateOrg,
  invalidateReleaseCutoff,
  revokeUserTokens,
} from "../lib/accountState";
import { track } from "../lib/analytics";

export const adminRouter = Router();

const VALID_ROLES: Role[] = ["facilitator", "participant", "admin"];

/**
 * Every route here is workspace-scoped by `req.auth.orgId`. A workspace admin
 * is a customer, not an operator: they administer their own team and must never
 * be able to read or touch another workspace.
 */
adminRouter.use(requireAuth, requireRole("admin"));

interface AdminUserDbRow {
  id: string;
  org_id: string;
  org_name: string;
  email: string;
  name: string;
  role: Role;
  status: AdminUserRow["status"];
  auth_provider: AdminUserRow["authProvider"];
  plan: string;
  created_at: string;
  last_active_at: string | null;
  session_count: string;
}

function toAdminUser(row: AdminUserDbRow): AdminUserRow {
  return {
    id: row.id,
    orgId: row.org_id,
    orgName: row.org_name,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    authProvider: row.auth_provider,
    plan: getPlan(row.plan).id,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    sessionCount: Number(row.session_count ?? 0),
  };
}

adminRouter.get("/users", async (req, res) => {
  try {
    const result = await db.query<AdminUserDbRow>(
      `SELECT u.id, u.org_id, o.name AS org_name, u.email, u.name, u.role, u.status,
              u.auth_provider, o.plan, u.created_at, u.last_active_at,
              (SELECT COUNT(*) FROM sessions s WHERE s.facilitator_id = u.id) AS session_count
       FROM users u
       JOIN organizations o ON o.id = u.org_id
       WHERE u.org_id = $1
       ORDER BY u.created_at DESC`,
      [req.auth!.orgId],
    );
    res.json({ ok: true, data: { users: result.rows.map(toAdminUser) } });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ ok: false, error: "Could not load the team" });
  }
});

/**
 * Create an account directly, for a beta member who should not have to go
 * through an invite. A generated password is returned exactly once — it is
 * never stored in readable form and cannot be retrieved again.
 */
adminRouter.post("/users", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const requestedRole = req.body?.role as Role | undefined;
    const role: Role = requestedRole && VALID_ROLES.includes(requestedRole) ? requestedRole : "participant";

    if (!email || !name) return res.status(400).json({ ok: false, error: "Name and email are required" });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "That does not look like an email address" });
    }

    const existing = await db.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, error: "That email already has an account" });
    }

    const orgRow = await db.query<{ plan: string; plan_status: string }>(
      `SELECT plan, plan_status FROM organizations WHERE id = $1`,
      [req.auth!.orgId],
    );
    const plan = effectivePlan(orgRow.rows[0]?.plan ?? null, orgRow.rows[0]?.plan_status ?? null);
    const seatError = await enforceSeatQuota(req.auth!.orgId, plan);
    if (seatError) return res.status(402).json({ ok: false, error: seatError });

    const tempPassword = randomBytes(9).toString("base64url");
    const id = newId("usr");
    const ts = now();

    await db.query(
      `INSERT INTO users (id, org_id, email, name, password_hash, role, created_at, invited_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, req.auth!.orgId, email, name, bcrypt.hashSync(tempPassword, 10), role, ts, req.auth!.sub],
    );

    track({
      event: "admin_user_created",
      orgId: req.auth!.orgId,
      userId: req.auth!.sub,
      props: { role },
    });

    res.status(201).json({
      ok: true,
      data: {
        user: { id, email, name, role, status: "active" },
        // Shown once, in the response to the admin who created the account.
        temporaryPassword: tempPassword,
      },
    });
  } catch (error) {
    console.error("Admin create user error:", error);
    res.status(500).json({ ok: false, error: "Could not create that account" });
  }
});

adminRouter.patch("/users/:id", async (req, res) => {
  try {
    const target = await db.query<{ id: string; org_id: string; role: Role }>(
      `SELECT id, org_id, role FROM users WHERE id = $1`,
      [req.params.id],
    );
    const user = target.rows[0];
    if (!user || user.org_id !== req.auth!.orgId) {
      return res.status(404).json({ ok: false, error: "Member not found" });
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    let rolesChanged = false;

    if (typeof req.body?.role === "string") {
      const role = req.body.role as Role;
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ ok: false, error: "Unknown role" });
      }

      // A workspace must keep at least one admin, or nobody can undo this.
      if (user.role === "admin" && role !== "admin") {
        const admins = await db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM users WHERE org_id = $1 AND role = 'admin' AND status = 'active'`,
          [user.org_id],
        );
        if (Number(admins.rows[0]?.count ?? 0) <= 1) {
          return res.status(409).json({ ok: false, error: "This workspace needs at least one admin" });
        }
      }

      updates.push(`role = $${idx++}`);
      params.push(role);
      rolesChanged = true;
    }

    if (typeof req.body?.name === "string" && req.body.name.trim()) {
      updates.push(`name = $${idx++}`);
      params.push(req.body.name.trim().slice(0, 80));
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: "No supported fields provided" });
    }

    params.push(user.id);
    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`, params);

    // A permission change has to bite now, not when their week-old token
    // happens to expire.
    if (rolesChanged) await revokeUserTokens(user.id);
    invalidateAccount(user.id);

    res.json({ ok: true, data: { updated: true, reauthRequired: rolesChanged } });
  } catch (error) {
    console.error("Admin update user error:", error);
    res.status(500).json({ ok: false, error: "Could not update that member" });
  }
});

/**
 * Suspend, revoke, or restore access.
 *
 * Neither suspend nor revoke deletes anything: their meetings, transcripts, and
 * decisions stay where they are. What changes is that the next request they
 * make — inside a second, not at token expiry — is refused.
 */
adminRouter.post("/users/:id/status", async (req, res) => {
  try {
    const status = req.body?.status;
    if (!["active", "suspended", "revoked"].includes(status)) {
      return res.status(400).json({ ok: false, error: "status must be active, suspended or revoked" });
    }

    const target = await db.query<{ id: string; org_id: string; role: Role; status: string }>(
      `SELECT id, org_id, role, status FROM users WHERE id = $1`,
      [req.params.id],
    );
    const user = target.rows[0];
    if (!user || user.org_id !== req.auth!.orgId) {
      return res.status(404).json({ ok: false, error: "Member not found" });
    }
    if (user.id === req.auth!.sub && status !== "active") {
      return res.status(409).json({ ok: false, error: "You cannot revoke your own access" });
    }

    if (user.role === "admin" && status !== "active") {
      const admins = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users WHERE org_id = $1 AND role = 'admin' AND status = 'active'`,
        [user.org_id],
      );
      if (Number(admins.rows[0]?.count ?? 0) <= 1) {
        return res.status(409).json({ ok: false, error: "This workspace needs at least one active admin" });
      }
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 200) || null : null;

    await db.query(
      `UPDATE users SET status = $1, status_reason = $2, token_valid_after = CASE WHEN $1 = 'active' THEN token_valid_after ELSE NOW() END
       WHERE id = $3`,
      [status, reason, user.id],
    );
    invalidateAccount(user.id);

    track({
      event: "admin_user_status_changed",
      orgId: req.auth!.orgId,
      userId: req.auth!.sub,
      props: { status, target: user.id },
    });

    res.json({ ok: true, data: { id: user.id, status } });
  } catch (error) {
    console.error("Admin status change error:", error);
    res.status(500).json({ ok: false, error: "Could not change that member's access" });
  }
});

/** Ends every session a member has open, without changing their permissions. */
adminRouter.post("/users/:id/sign-out", async (req, res) => {
  try {
    const target = await db.query<{ id: string; org_id: string }>(
      `SELECT id, org_id FROM users WHERE id = $1`,
      [req.params.id],
    );
    const user = target.rows[0];
    if (!user || user.org_id !== req.auth!.orgId) {
      return res.status(404).json({ ok: false, error: "Member not found" });
    }
    await revokeUserTokens(user.id);
    res.json({ ok: true, data: { signedOut: true } });
  } catch (error) {
    console.error("Admin sign-out error:", error);
    res.status(500).json({ ok: false, error: "Could not sign that member out" });
  }
});

adminRouter.get("/workspace", async (req, res) => {
  try {
    const org = await db.query(`SELECT * FROM organizations WHERE id = $1`, [req.auth!.orgId]);
    if (!org.rows[0]) return res.status(404).json({ ok: false, error: "Workspace not found" });

    const usage = await getUsage(req.auth!.orgId);
    const plan = effectivePlan(org.rows[0].plan, org.rows[0].plan_status);

    res.json({
      ok: true,
      data: {
        workspace: org.rows[0],
        plan,
        usage,
        catalog: Object.values(PLANS),
      },
    });
  } catch (error) {
    console.error("Admin workspace error:", error);
    res.status(500).json({ ok: false, error: "Could not load the workspace" });
  }
});

adminRouter.patch("/workspace", async (req, res) => {
  try {
    if (typeof req.body?.name !== "string" || !req.body.name.trim()) {
      return res.status(400).json({ ok: false, error: "Workspace name is required" });
    }
    await db.query(`UPDATE organizations SET name = $1 WHERE id = $2`, [
      req.body.name.trim().slice(0, 80),
      req.auth!.orgId,
    ]);
    invalidateOrg(req.auth!.orgId);
    res.json({ ok: true, data: { updated: true } });
  } catch (error) {
    console.error("Admin workspace update error:", error);
    res.status(500).json({ ok: false, error: "Could not rename the workspace" });
  }
});

/** Beta usage, scoped to this workspace. */
adminRouter.get("/metrics", async (req, res) => {
  try {
    const orgId = req.auth!.orgId;

    const [activity, sessions, meetings, checkpoint, feedback, topEvents, daily] = await Promise.all([
      db.query<{ daily: string; weekly: string; monthly: string }>(
        `SELECT
           COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')  AS daily,
           COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS weekly,
           COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS monthly
         FROM analytics_events WHERE org_id = $1`,
        [orgId],
      ),
      db.query<{ total: string; last7d: string; avg_minutes: string | null }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE s.created_at >= NOW() - INTERVAL '7 days') AS last7d,
                AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60)
                  FILTER (WHERE s.ended_at IS NOT NULL AND s.started_at IS NOT NULL) AS avg_minutes
         FROM sessions s JOIN meetings m ON m.id = s.meeting_id
         WHERE m.org_id = $1`,
        [orgId],
      ),
      db.query<{ total: string; last7d: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS last7d
         FROM meetings WHERE org_id = $1`,
        [orgId],
      ),
      db.query<{ sessions_with: string; decisions: string; complete: string }>(
        `SELECT COUNT(DISTINCT d.session_id) AS sessions_with,
                COUNT(*) AS decisions,
                COUNT(*) FILTER (WHERE d.status = 'complete') AS complete
         FROM decisions d JOIN meetings m ON m.id = d.meeting_id
         WHERE m.org_id = $1 AND d.dismissed = FALSE`,
        [orgId],
      ),
      db.query<{ total: string; open: string; avg_rating: string | null }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status IN ('new','triaged')) AS open,
                AVG(rating) FILTER (WHERE rating IS NOT NULL) AS avg_rating
         FROM feedback WHERE org_id = $1`,
        [orgId],
      ),
      db.query<{ event: string; count: string }>(
        `SELECT event, COUNT(*) AS count FROM analytics_events
         WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY event ORDER BY count DESC LIMIT 12`,
        [orgId],
      ),
      db.query<{ day: string; users: string }>(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                COUNT(DISTINCT user_id) AS users
         FROM analytics_events
         WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY 1 ORDER BY 1`,
        [orgId],
      ),
    ]);

    const orgCount = await db.query<{ seats: string }>(
      `SELECT COUNT(*) AS seats FROM users WHERE org_id = $1 AND status = 'active'`,
      [orgId],
    );

    const decisions = Number(checkpoint.rows[0]?.decisions ?? 0);
    const complete = Number(checkpoint.rows[0]?.complete ?? 0);

    const metrics: BetaMetrics = {
      activeUsers: {
        daily: Number(activity.rows[0]?.daily ?? 0),
        weekly: Number(activity.rows[0]?.weekly ?? 0),
        monthly: Number(activity.rows[0]?.monthly ?? 0),
      },
      members: { total: Number(orgCount.rows[0]?.seats ?? 0) },
      sessions: {
        total: Number(sessions.rows[0]?.total ?? 0),
        last7d: Number(sessions.rows[0]?.last7d ?? 0),
        avgMinutes: sessions.rows[0]?.avg_minutes ? Number(sessions.rows[0].avg_minutes) : null,
      },
      meetings: {
        total: Number(meetings.rows[0]?.total ?? 0),
        last7d: Number(meetings.rows[0]?.last7d ?? 0),
      },
      checkpoint: {
        sessionsWithDecisions: Number(checkpoint.rows[0]?.sessions_with ?? 0),
        decisions,
        completeRate: decisions > 0 ? complete / decisions : null,
      },
      feedback: {
        total: Number(feedback.rows[0]?.total ?? 0),
        open: Number(feedback.rows[0]?.open ?? 0),
        avgRating: feedback.rows[0]?.avg_rating ? Number(feedback.rows[0].avg_rating) : null,
      },
      topEvents: topEvents.rows.map((row) => ({ event: row.event, count: Number(row.count) })),
      dailyActive: daily.rows.map((row) => ({ day: row.day, users: Number(row.users) })),
    };

    res.json({ ok: true, data: { metrics } });
  } catch (error) {
    console.error("Admin metrics error:", error);
    res.status(500).json({ ok: false, error: "Could not load beta metrics" });
  }
});

adminRouter.get("/feedback", async (req, res) => {
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

adminRouter.patch("/feedback/:id", async (req, res) => {
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
 */
adminRouter.post("/release", async (req, res) => {
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

adminRouter.get("/plan-requests", async (req, res) => {
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
