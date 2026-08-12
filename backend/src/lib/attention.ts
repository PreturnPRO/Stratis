import { db } from "../db/database";

/**
 * What the team still has to decide — the dashboard's first answer.
 *
 * The dashboard used to open on meetings and summaries, which is what a
 * transcription product opens on. Stratis claims to track the state of a
 * decision, so the first thing on the screen is the state of the decisions:
 * what is unanswered, what is half-decided, and what someone owes by a date.
 *
 * Three counts and two short lists, all derived from `decisions` — no new
 * table, and nothing here that the checkpoint did not already record.
 */

export interface AttentionCounts {
  /** Unanswered: the checkpoint asked and the room never settled it. */
  openQuestions: number;
  /** Structurally incomplete: a decision exists but is missing an element. */
  inProgress: number;
  /** Owed by a date that has arrived, and not ticked off. */
  followUpsDue: number;
}

export interface RecentDecision {
  id: string;
  text: string;
  owner: string | null;
  decidedAt: string;
  meetingTitle: string | null;
  projectName: string | null;
}

const LIVE = `d.dismissed = FALSE AND d.done_at IS NULL`;

export async function attentionCounts(orgId: string, userId: string): Promise<AttentionCounts> {
  const result = await db.query<{
    open_questions: string;
    in_progress: string;
    follow_ups_due: string;
  }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE d.status = 'open')                       AS open_questions,
      COUNT(*) FILTER (WHERE d.status = 'incomplete')                 AS in_progress,
      COUNT(*) FILTER (WHERE d.due_date IS NOT NULL AND d.due_date <= NOW()) AS follow_ups_due
    FROM decisions d
    JOIN meetings m ON m.id = d.meeting_id
    WHERE m.org_id = $1
      AND m.created_by = $2
      AND ${LIVE}
    `,
    [orgId, userId],
  );

  const row = result.rows[0];
  return {
    openQuestions: Number(row?.open_questions ?? 0),
    inProgress: Number(row?.in_progress ?? 0),
    followUpsDue: Number(row?.follow_ups_due ?? 0),
  };
}

/**
 * What the team actually settled, newest first.
 *
 * "Recent summaries" answers "what happened"; this answers "what did we
 * decide", which is the thing nobody can reconstruct six weeks later.
 */
export async function recentDecisions(
  orgId: string,
  userId: string,
  limit: number,
): Promise<RecentDecision[]> {
  const result = await db.query<{
    id: string;
    text: string;
    owner: string | null;
    decided_at: string;
    meeting_title: string | null;
    project_name: string | null;
  }>(
    `
    SELECT
      d.id,
      d.text,
      d.owner,
      COALESCE(d.updated_at, d.created_at) AS decided_at,
      m.title AS meeting_title,
      COALESCE(p.name, m.project_id) AS project_name
    FROM decisions d
    JOIN meetings m ON m.id = d.meeting_id
    LEFT JOIN projects p ON p.id = m.project_id
    WHERE m.org_id = $1
      AND m.created_by = $2
      AND d.dismissed = FALSE
      AND d.status = 'complete'
    ORDER BY COALESCE(d.updated_at, d.created_at) DESC
    LIMIT $3
    `,
    [orgId, userId, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    text: row.text,
    owner: row.owner,
    decidedAt: row.decided_at,
    meetingTitle: row.meeting_title,
    projectName: row.project_name,
  }));
}

/**
 * How much of the next meeting is already unsettled.
 *
 * The count travels with the meeting rather than being fetched per card: the
 * dashboard shows one next meeting, and a per-card request would be a query per
 * row for a number that is the whole point of the card.
 */
export async function unresolvedForProject(orgId: string, projectId: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    `
    SELECT COUNT(*) AS count
    FROM decisions d
    JOIN meetings m ON m.id = d.meeting_id
    WHERE m.org_id = $1
      AND m.project_id = $2
      AND ${LIVE}
      AND d.status IN ('open', 'incomplete')
    `,
    [orgId, projectId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
