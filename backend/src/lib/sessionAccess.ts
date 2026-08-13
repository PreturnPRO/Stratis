import { db } from "../db/database";

/**
 * One place that answers "may this account touch this session".
 *
 * It lived inside routes/session.ts, so every router that grew its own session
 * handling had to remember to re-implement it — and routes/ai.ts did not. Those
 * five handlers took a session id from the request body, carried `requireAuth`,
 * and checked nothing else: any account could read another workspace's live
 * suggestion cards, push cards onto a stranger's facilitator screen mid-meeting,
 * and mark or delete them.
 *
 * No admin bypass, matching session/transcript/summary/document: administering
 * a workspace is not a reason to read or write the decisions of a meeting
 * somebody else is running.
 */
export interface SessionAccessRow {
  id: string;
  meeting_id: string;
  facilitator_id: string;
  status: "created" | "active" | "ended";
  org_id: string | null;
}

export type SessionAccess =
  | { ok: true; session: SessionAccessRow }
  | { ok: false; status: number; error: string };

export async function checkSessionAccess(
  sessionId: string,
  userId: string,
  orgId: string,
): Promise<SessionAccess> {
  if (!sessionId) {
    return { ok: false, status: 400, error: "sessionId is required" };
  }

  const result = await db.query<SessionAccessRow>(
    `SELECT s.id, s.meeting_id, s.facilitator_id, s.status, m.org_id
     FROM sessions s
     LEFT JOIN meetings m ON m.id = s.meeting_id
     WHERE s.id = $1`,
    [sessionId],
  );

  const session = result.rows[0];
  if (!session) {
    return { ok: false, status: 404, error: "Session not found" };
  }

  // Same answer for "wrong workspace" and "not yours": a 403 that distinguishes
  // them confirms a session id exists, which is the first half of finding one.
  if (session.org_id !== orgId || session.facilitator_id !== userId) {
    return { ok: false, status: 403, error: "You do not have access to this session" };
  }

  return { ok: true, session };
}
