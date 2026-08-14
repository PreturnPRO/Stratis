import type { Request, Response, NextFunction } from "express";
import { AUTH_ERROR_CODES, type FeatureKey, type PlanUsage } from "@shared/types";
import { db } from "../db/database";
import { hasFeature } from "./plans";

/**
 * Gate a route on a plan capability. The 402 carries the plan the caller is on
 * and the feature they hit, so the client can send them to the right place on
 * the pricing page instead of showing a generic wall.
 */
export function requireFeature(feature: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    const plan = req.account?.plan;
    if (!plan) return res.status(401).json({ ok: false, error: "Not authenticated" });
    if (!hasFeature(plan, feature)) {
      return res.status(402).json({
        ok: false,
        error: `Your ${plan.name} workspace does not include this`,
        code: AUTH_ERROR_CODES.planRequired,
        data: { feature, plan: plan.id },
      });
    }
    next();
  };
}

/** Usage counted against the current calendar month, in the org's own rows. */
export async function getUsage(orgId: string): Promise<PlanUsage> {
  const result = await db.query<{
    meetings_this_month: string;
    sessions_this_month: string;
    recorded_minutes_this_month: string;
    projects_used: string;
    seats_used: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM meetings
         WHERE org_id = $1 AND created_at >= date_trunc('month', NOW())) AS meetings_this_month,
       (SELECT COUNT(*) FROM sessions s
          JOIN meetings m ON m.id = s.meeting_id
         WHERE m.org_id = $1 AND s.created_at >= date_trunc('month', NOW())) AS sessions_this_month,
       -- Minutes actually listened to this month. A session still running
       -- counts up to now, so a workspace cannot sit on one open recording all
       -- month and stay inside a budget it is spending.
       (SELECT COALESCE(ROUND(SUM(
            EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at)) / 60
          )), 0)
          FROM sessions s
          JOIN meetings m ON m.id = s.meeting_id
         WHERE m.org_id = $1
           AND s.started_at IS NOT NULL
           AND s.started_at >= date_trunc('month', NOW())) AS recorded_minutes_this_month,
       (SELECT COUNT(*) FROM projects WHERE org_id = $1) AS projects_used,
       (SELECT COUNT(*) FROM users
         WHERE org_id = $1 AND status = 'active') AS seats_used`,
    [orgId],
  );

  const row = result.rows[0];
  return {
    meetingsThisMonth: Number(row?.meetings_this_month ?? 0),
    sessionsThisMonth: Number(row?.sessions_this_month ?? 0),
    recordedMinutesThisMonth: Number(row?.recorded_minutes_this_month ?? 0),
    projectsUsed: Number(row?.projects_used ?? 0),
    seatsUsed: Number(row?.seats_used ?? 0),
  };
}

/**
 * The trial's real boundary: minutes listened to, checked when a session is
 * about to start rather than when a meeting is booked.
 *
 * Returns a sentence when the workspace is out, null when it may proceed. The
 * caller decides the status code, because starting a session and creating a
 * project fail differently.
 */
export async function recordedMinutesExceeded(
  orgId: string,
  plan: { limits: { recordedMinutesPerMonth: number | null }; name: string },
): Promise<string | null> {
  const limit = plan.limits.recordedMinutesPerMonth;
  if (limit === null) return null;

  const usage = await getUsage(orgId);
  if (usage.recordedMinutesThisMonth < limit) return null;

  return `The ${plan.name} plan covers ${limit} recorded minutes a month. You have used ${usage.recordedMinutesThisMonth}.`;
}
