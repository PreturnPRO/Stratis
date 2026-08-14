import { db } from "../db/database";

/**
 * The one write that makes the operator console cheap.
 *
 * Counted when a meeting ends, never when someone looks. A launch means many
 * operators refreshing and many meetings recording at the same time, on one
 * database — and a console that aggregates live turns every refresh into a scan
 * of every workspace's sessions, transcripts, decisions and cards. Meetings end
 * far less often than a page is refreshed, so the work happens once, here.
 *
 * Counts only. Nothing on `session_rollups` can reconstruct anything anybody
 * said.
 */
export async function writeSessionRollup(sessionId: string): Promise<void> {
  await db.query(
    `
    INSERT INTO session_rollups (
      session_id, org_id, facilitator_id, ended_at,
      recorded_minutes, transcript_rows, decisions, cards, participants
    )
    SELECT
      s.id,
      m.org_id,
      s.facilitator_id,
      COALESCE(s.ended_at, NOW()),
      -- Ceiling, and never negative: a clock that went backwards must not
      -- produce a meeting of minus three minutes in the totals.
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at)) / 60.0))::int,
      (SELECT COUNT(*) FROM transcripts t WHERE t.session_id = s.id),
      (SELECT COUNT(*) FROM decisions d WHERE d.session_id = s.id AND d.dismissed = FALSE),
      (SELECT COUNT(*) FROM live_cards c WHERE c.session_id = s.id),
      (SELECT COUNT(*) FROM session_participants p WHERE p.session_id = s.id)
    FROM sessions s
    JOIN meetings m ON m.id = s.meeting_id
    WHERE s.id = $1
      AND s.started_at IS NOT NULL
    -- The end path can run twice (the End button and the idle sweeper race for
    -- it), and the second writer must be a no-op rather than a duplicate row.
    ON CONFLICT (session_id) DO NOTHING
    `,
    [sessionId],
  );
}

export interface UsageDay {
  /** YYYY-MM-DD, the server's day. */
  day: string;
  meetings: number;
  recordedMinutes: number;
}

/**
 * One row per day in the window, including the days nothing happened.
 *
 * `generate_series` rather than grouping what exists: a chart built only from
 * days with meetings silently compresses a quiet fortnight into a busy-looking
 * line. A zero is a fact and gets a bar of its own.
 */
export async function usageByDay(days: number): Promise<UsageDay[]> {
  const result = await db.query<{ day: string; meetings: string; recorded_minutes: string }>(
    `
    SELECT
      to_char(d.day, 'YYYY-MM-DD') AS day,
      COUNT(r.session_id) AS meetings,
      COALESCE(SUM(r.recorded_minutes), 0) AS recorded_minutes
    -- make_interval with an explicit ::int rather than building a string and
    -- casting it. The string form leaned on Postgres inferring the parameter's
    -- type from an arithmetic operator, which is a coin flip worth not tossing
    -- in a query that only ever runs in production.
    FROM generate_series(
           date_trunc('day', NOW()) - make_interval(days => $1::int - 1),
           date_trunc('day', NOW()),
           INTERVAL '1 day'
         ) AS d(day)
    LEFT JOIN session_rollups r
      ON r.ended_at >= d.day AND r.ended_at < d.day + INTERVAL '1 day'
    GROUP BY d.day
    ORDER BY d.day ASC
    `,
    [days],
  );

  return result.rows.map((row) => ({
    day: row.day,
    meetings: Number(row.meetings ?? 0),
    recordedMinutes: Number(row.recorded_minutes ?? 0),
  }));
}

export interface OperatorUsage {
  orgId: string;
  orgName: string;
  plan: string;
  meetings: number;
  recordedMinutes: number;
  decisions: number;
  lastMeetingAt: string | null;
}

/**
 * Every workspace, newest activity first — read straight off the rollups.
 *
 * `days` bounds the window so the console cannot accidentally ask for the
 * product's whole history on a launch morning.
 */
export async function operatorUsage(days: number): Promise<OperatorUsage[]> {
  const result = await db.query<{
    org_id: string;
    org_name: string;
    plan: string;
    meetings: string;
    recorded_minutes: string;
    decisions: string;
    last_meeting_at: string | null;
  }>(
    `
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      o.plan,
      COUNT(r.session_id) AS meetings,
      COALESCE(SUM(r.recorded_minutes), 0) AS recorded_minutes,
      COALESCE(SUM(r.decisions), 0) AS decisions,
      MAX(r.ended_at) AS last_meeting_at
    FROM organizations o
    LEFT JOIN session_rollups r
      ON r.org_id = o.id
     AND r.ended_at > NOW() - make_interval(days => $1::int)
    GROUP BY o.id, o.name, o.plan
    ORDER BY MAX(r.ended_at) DESC NULLS LAST, o.name ASC
    LIMIT 200
    `,
    [days],
  );

  return result.rows.map((row) => ({
    orgId: row.org_id,
    orgName: row.org_name,
    plan: row.plan,
    meetings: Number(row.meetings ?? 0),
    recordedMinutes: Number(row.recorded_minutes ?? 0),
    decisions: Number(row.decisions ?? 0),
    lastMeetingAt: row.last_meeting_at,
  }));
}
