
import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { clearProjectDocCache } from "./transcript";
import { forgetSession } from "../realtime/liveness";
import {
  extractAndSaveDecisions,
  getDecisions,
  completenessFromRecords,
  updateDecision,
  type DecisionPatch,
} from "../lib/decisions";
import { generateAndSaveSummary } from "../lib/summaryStore";
import { writeSessionRollup } from "../lib/rollups";
import { effectivePlan } from "../lib/plans";
import { recordedMinutesExceeded } from "../lib/entitlements";
import { AUTH_ERROR_CODES } from "@shared/types";

export const sessionRouter = Router();

type SessionStatus = "created" | "active" | "ended";

interface SessionRow {
  id: string;
  meeting_id: string;
  facilitator_id: string;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface MeetingRow {
  id: string;
  org_id: string;
  project_id: string;
  title: string;
  scheduled_at: string | null;
  created_by: string | null;
  created_at: string;
}

interface SessionWithMeetingRow  extends SessionRow {
  meeting_title: string | null;
  project_id: string | null;
}

interface CountRow {
  count: string;
}

async function getSession(sessionId: string): Promise<any> {
  const result = await db.query<any>(
    `SELECT s.id, s.meeting_id, s.facilitator_id, s.status, s.started_at, s.ended_at, s.created_at,
            m.duration_minutes, m.org_id
     FROM sessions s
     LEFT JOIN meetings m ON m.id = s.meeting_id
     WHERE s.id = $1`,
    [sessionId]
  );
  const [firstRow] = result.rows;
  return firstRow;
}

async function getMeeting(meetingId: string): Promise<MeetingRow | undefined> {
  const result = await db.query<MeetingRow>(
    `
    SELECT
      id,
      org_id,
      project_id,
      title,
      scheduled_at,
      created_by,
      created_at
    FROM meetings
    WHERE id = $1
    `,
    [meetingId],
  );
  return result.rows[0];
}

/**
 * "admin" is a role inside one workspace, not across the product, and signup
 * lets an account choose it. Without the org check an account created in thirty
 * seconds could read, start, end, and rewrite the decisions of any session in
 * the database.
 */
function canAccessSession(
  session: SessionRow & { org_id?: string | null },
  userId: string,
  _role: string,
  orgId: string,
): boolean {
  if (session.org_id !== orgId) return false;
  // No admin bypass: administering a workspace is not a reason to open, end,
  // or rewrite the decisions of a meeting someone else is running.
  return session.facilitator_id === userId;
}

async function requireAccessibleSession(
  sessionId: string,
  userId: string,
  role: string,
  orgId: string,
) {
  const session = await getSession(sessionId);

  if (!session) {
    return {
      ok: false as const,
      status: 404,
      error: "Session not found",
    };
  }

  if (!canAccessSession(session, userId, role, orgId)) {
    return {
      ok: false as const,
      status: 403,
      error: "You do not have access to this session",
    };
  }

  return {
    ok: true as const,
    session,
  };
}

/**
 * @param endedAt When the meeting actually stopped, if that is not now. The
 * idle sweeper passes the last moment audio arrived: it runs up to a minute
 * after a 15-minute idle limit expires, and stamping its own clock billed a
 * facilitator who closed their laptop for the whole 16 minutes they were not
 * speaking — a quarter of the free tier's monthly allowance, spent on silence.
 */
export async function endSession(sessionId: string, endedAt?: string): Promise<any> {
  const session = await getSession(sessionId);
  if (!session) return undefined;
  if (session.status === "ended") return session;

  const timestamp = now();
  const stoppedAt = endedAt ?? timestamp;

  await db.query(
    `
    UPDATE sessions
    SET status = 'ended',
        started_at = COALESCE(started_at, $1),
        ended_at = COALESCE(ended_at, $2)
    WHERE id = $3
    `,
    [timestamp, stoppedAt, session.id],
  );

  clearProjectDocCache(session.id);
  forgetSession(session.id);

  // Counted here, once, so the operator console never aggregates live. Failing
  // to write a rollup must not fail the end of a meeting: the meeting is the
  // product, the count is a report.
  void writeSessionRollup(session.id).catch((err) =>
    console.error(`[session:end] usage rollup failed for ${session.id}:`, err),
  );

  void extractAndSaveDecisions(session.id)
    .catch((err) =>
      console.error(`[session:end] decision extraction failed for ${session.id}:`, err),
    )
    .then(() => generateAndSaveSummary(session.id))
    .then((stored) => {
      if (stored) console.log(`[session:end] summary stored for ${session.id}`);
    })
    .catch((err) =>
      console.error(`[session:end] summary persist failed for ${session.id}:`, err),
    );

  return getSession(session.id);
}

sessionRouter.get("/", requireAuth, async (req, res) => {
  try {
    // Own sessions, whatever the role. The admin branch here used to return
    // every session in the workspace, which is the listing that made another
    // person's meeting openable in the first place.
    const result = await db.query<SessionWithMeetingRow>(
      `
      SELECT
        s.id,
        s.meeting_id,
        s.facilitator_id,
        s.status,
        s.started_at,
        s.ended_at,
        s.created_at,
        m.title AS meeting_title,
        m.project_id AS project_id
      FROM sessions s
      JOIN meetings m ON m.id = s.meeting_id
      WHERE s.facilitator_id = $1
        AND m.org_id = $2
      ORDER BY s.created_at DESC
      `,
      [req.auth!.sub, req.auth!.orgId],
    );

    res.json({ ok: true, data: { sessions: result.rows } });
  } catch (error) {
    console.error("List sessions error:", error);
    res
      .status(500)
      .json({ ok: false, error: "Internal server error retrieving sessions" });
  }
});

sessionRouter.get("/active", requireAuth, async (req, res) => {
  try {
    // The caller's own live session. An admin picking up whichever session in
    // the workspace happened to be active is precisely how a second device
    // ended up writing to a meeting it was not running.
    const result = await db.query<SessionWithMeetingRow>(
      `
      SELECT
        s.id,
        s.meeting_id,
        s.facilitator_id,
        s.status,
        s.started_at,
        s.ended_at,
        s.created_at,
        m.title AS meeting_title,
        m.project_id AS project_id
      FROM sessions s
      JOIN meetings m ON m.id = s.meeting_id
      WHERE s.facilitator_id = $1
        AND m.org_id = $2
        AND s.status = 'active'
      ORDER BY s.started_at DESC
      LIMIT 1
      `,
      [req.auth!.sub, req.auth!.orgId],
    );

    res.json({ ok: true, data: { session: result.rows[0] ?? null } });
  } catch (error) {
    console.error("Get active session error:", error);
    res
      .status(500)
      .json({ ok: false, error: "Internal server error retrieving active session" });
  }
});

sessionRouter.post("/", requireAuth, async (req, res) => {
  try {
    const meetingId =
      typeof req.body?.meetingId === "string"
        ? req.body.meetingId
        : typeof req.body?.meeting_id === "string"
          ? req.body.meeting_id
          : "";

    if (!meetingId) {
      return res.status(400).json({
        ok: false,
        error: "body.meetingId is required",
      });
    }

    const meeting = await getMeeting(meetingId);

    if (!meeting) {
      return res.status(404).json({
        ok: false,
        error: "Meeting not found",
      });
    }

    // The org check is unconditional. "admin" used to skip it, which let a
    // workspace admin open a session on another workspace's meeting — and an
    // admin starting a second session against a meeting they do not run is
    // exactly how one project document ends up with two writers.
    if (meeting.org_id !== req.auth!.orgId) {
      return res.status(403).json({
        ok: false,
        error: "You cannot create a session for this meeting",
      });
    }

    // The trial's real boundary. Checked here rather than at meeting creation
    // because the cost is listening, not calendar entries — and checked before
    // the mic opens, since stopping someone mid-sentence is worse than not
    // starting.
    const orgRow = await db.query<{ plan: string | null; plan_status: string | null; plan_expires_at: string | null }>(
      `SELECT plan, plan_status, plan_expires_at FROM organizations WHERE id = $1`,
      [meeting.org_id],
    );
    const plan = effectivePlan(
      orgRow.rows[0]?.plan ?? null,
      orgRow.rows[0]?.plan_status ?? null,
      orgRow.rows[0]?.plan_expires_at ?? null,
    );
    const overBudget = await recordedMinutesExceeded(meeting.org_id, plan);
    if (overBudget) {
      return res.status(402).json({
        ok: false,
        error: overBudget,
        code: AUTH_ERROR_CODES.quotaExceeded,
        data: { limit: plan.limits.recordedMinutesPerMonth, plan: plan.id },
      });
    }

    const existingOpenSessionResult = await db.query<SessionRow>(
      `
      SELECT
        id,
        meeting_id,
        facilitator_id,
        status,
        started_at,
        ended_at,
        created_at
      FROM sessions
      WHERE meeting_id = $1
        AND status IN ('created', 'active')
      LIMIT 1
      `,
      [meetingId],
    );

    const existingOpenSession = existingOpenSessionResult.rows[0];

    if (existingOpenSession) {
      return res.status(409).json({
        ok: false,
        error: "This meeting already has an open session",
        data: {
          session: existingOpenSession,
        },
      });
    }

    const sessionId = newId("ses");
    const timestamp = now();

    await db.query(
      `
      INSERT INTO sessions (
        id,
        meeting_id,
        facilitator_id,
        status,
        started_at,
        ended_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [sessionId, meetingId, req.auth!.sub, "created", null, null, timestamp],
    );

    const session = await getSession(sessionId);

    res.status(201).json({
      ok: true,
      data: {
        session,
      },
    });
  } catch (error) {
    console.error("Session creation error:", error);
    res
      .status(500)
      .json({ ok: false, error: "Internal server error creating session" });
  }
});

sessionRouter.get("/recover", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.sub;
    const orgId = req.auth!.orgId;

    const result = await db.query(
      `
      SELECT
        s.id,
        s.meeting_id,
        s.facilitator_id,
        s.status,
        s.started_at,
        s.ended_at,
        s.created_at,
        m.org_id,
        m.project_id,
        m.title AS meeting_title,
        m.duration_minutes
      FROM sessions s
      JOIN meetings m ON m.id = s.meeting_id
      WHERE s.status IN ('active', 'created')
        AND m.org_id = $1
        AND s.facilitator_id = $2
      ORDER BY
        CASE s.status
          WHEN 'active' THEN 0
          WHEN 'created' THEN 1
          ELSE 2
        END,
        COALESCE(s.started_at, s.created_at) DESC
      LIMIT 1
      `,
      [orgId, userId],
    );

    const row = result.rows[0];

    if (!row) {
      return res.json({
        ok: true,
        data: {
          recovered: false,
          session: null,
          reason: "no_active_or_created_session",
        },
      });
    }

    res.json({
      ok: true,
      data: {
        recovered: true,
        session: row,
        /**
         * The server's clock, so the meeting timer can stop trusting the
         * browser's.
         *
         * Elapsed time belongs to the session, not to the tab looking at it:
         * close the laptop for five minutes and the meeting was still running,
         * which is exactly what the biller already counts
         * (`COALESCE(ended_at, NOW()) - started_at`). The client subtracts this
         * from its own clock once and applies the offset from then on, so a
         * device with a wrong time still shows the right elapsed figure — and
         * the number on screen matches the minutes being deducted.
         */
        serverNow: now(),
      },
    });
  } catch (error) {
    console.error("Session recover error:", error);
    res
      .status(500)
      .json({ ok: false, error: "Internal server error recovering session" });
  }
});

sessionRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const accessible = await requireAccessibleSession(
      req.params.id,
      req.auth!.sub,
      req.auth!.role,
      req.auth!.orgId,
    );

    if (!accessible.ok) {
      return res.status(accessible.status).json({
        ok: false,
        error: accessible.error,
      });
    }

    const transcriptCountResult = await db.query<CountRow>(
      `
      SELECT COUNT(*) AS count
      FROM transcripts
      WHERE session_id = $1
      `,
      [accessible.session.id],
    );

    const notificationCountResult = await db.query<CountRow>(
      `
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE session_id = $1
      `,
      [accessible.session.id],
    );

    res.json({
      ok: true,
      data: {
        session: accessible.session,
        links: {
          transcriptCount: Number(transcriptCountResult.rows[0]?.count ?? 0),
          notificationCount: Number(
            notificationCountResult.rows[0]?.count ?? 0,
          ),
        },
      },
    });
  } catch (error) {
    console.error("Session fetch error:", error);
    res
      .status(500)
      .json({ ok: false, error: "Internal server error retrieving session" });
  }
});

sessionRouter.post("/:id/start", requireAuth, async (req, res) => {
  try {
    const accessible = await requireAccessibleSession(
      req.params.id,
      req.auth!.sub,
      req.auth!.role,
      req.auth!.orgId,
    );

    if (!accessible.ok) {
      return res.status(accessible.status).json({
        ok: false,
        error: accessible.error,
      });
    }

    const session = accessible.session;

    if (session.status === "ended") {
      return res.status(409).json({
        ok: false,
        error: "Cannot start an ended session",
      });
    }

    if (session.status === "active") {
      return res.json({
        ok: true,
        data: {
          session,
        },
      });
    }

    const timestamp = now();

    await db.query(
      `
      UPDATE sessions
      SET status = 'active',
          started_at = COALESCE(started_at, $1)
      WHERE id = $2
      `,
      [timestamp, session.id],
    );

    const updated = await getSession(session.id);

    res.json({
      ok: true,
      data: {
        session: updated,
      },
    });
  } catch (error) {
    console.error("Session start error:", error);
    res
      .status(500)
      .json({ ok: false, error: "Internal server error starting session" });
  }
});

sessionRouter.post("/:id/end", requireAuth, async (req, res) => {
  try {
    const accessible = await requireAccessibleSession(
      req.params.id,
      req.auth!.sub,
      req.auth!.role,
      req.auth!.orgId,
    );

    if (!accessible.ok) {
      return res.status(accessible.status).json({
        ok: false,
        error: accessible.error,
      });
    }

    const session = accessible.session;

    if (session.status === "ended") {
      return res.json({
        ok: true,
        data: {
          session,
          summaryTrigger: "already_ended",
        },
      });
    }

    const updated = await endSession(session.id);

    res.json({
      ok: true,
      data: {
        session: updated,
        summaryTrigger: "stubbed",
      },
    });
  } catch (error) {
    console.error("Session end error:", error);
    res
      .status(500)
      .json({ ok: false, error: "Internal server error ending session" });
  }
});

sessionRouter.get("/:id/decisions", requireAuth, async (req, res) => {
  try {
    const accessible = await requireAccessibleSession(req.params.id, req.auth!.sub, req.auth!.role, req.auth!.orgId);
    if (!accessible.ok) {
      return res.status(accessible.status).json({ ok: false, error: accessible.error });
    }
    const decisions = await getDecisions(req.params.id);
    res.json({
      ok: true,
      data: { decisions, metric: completenessFromRecords(decisions) },
    });
  } catch (error) {
    console.error("Session decisions fetch error:", error);
    res.status(500).json({ ok: false, error: "Internal server error loading decisions" });
  }
});

sessionRouter.post("/:id/decisions/extract", requireAuth, async (req, res) => {
  try {
    const accessible = await requireAccessibleSession(req.params.id, req.auth!.sub, req.auth!.role, req.auth!.orgId);
    if (!accessible.ok) {
      return res.status(accessible.status).json({ ok: false, error: accessible.error });
    }
    // Only an explicit re-run spends a second extraction on one transcript.
    const force = req.body?.force === true;
    const decisions = await extractAndSaveDecisions(req.params.id, { force });
    res.json({
      ok: true,
      data: { decisions, metric: completenessFromRecords(decisions) },
    });
  } catch (error) {
    console.error("Session decisions extract error:", error);
    res.status(500).json({ ok: false, error: "Internal server error extracting decisions" });
  }
});

sessionRouter.patch("/:id/decisions/:decisionId", requireAuth, async (req, res) => {
  try {
    const accessible = await requireAccessibleSession(req.params.id, req.auth!.sub, req.auth!.role, req.auth!.orgId);
    if (!accessible.ok) {
      return res.status(accessible.status).json({ ok: false, error: accessible.error });
    }

    const body = req.body ?? {};
    const patch: DecisionPatch = {};
    if ("dueDate" in body) patch.dueDate = typeof body.dueDate === "string" ? body.dueDate : null;
    if ("owner" in body) patch.owner = typeof body.owner === "string" ? body.owner : null;
    if ("revisit" in body) patch.revisit = typeof body.revisit === "string" ? body.revisit : null;
    if (typeof body.text === "string") patch.text = body.text;
    if (typeof body.dismissed === "boolean") patch.dismissed = body.dismissed;
    if (typeof body.done === "boolean") patch.done = body.done;
    if (body.status === "complete" || body.status === "incomplete" || body.status === "open") {
      patch.status = body.status;
    }

    const updated = await updateDecision(req.params.id, req.params.decisionId, patch);
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Decision not found for this session" });
    }

    const decisions = await getDecisions(req.params.id);
    res.json({
      ok: true,
      data: { decision: updated, metric: completenessFromRecords(decisions) },
    });
  } catch (error) {
    console.error("Session decision update error:", error);
    res.status(500).json({ ok: false, error: "Internal server error updating decision" });
  }
});
