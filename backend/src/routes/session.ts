// /api/session — S1-T03-F
//
// Meeting session lifecycle:
// - create session linked to a meeting
// - start session, which begins capture
// - end session, which becomes the summary-generation trigger point
//
// Session ID is the anchor for:
// - transcripts
// - live AI outputs / suggestion cards
// - summaries
// - future tree nodes
// - future document outputs

import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { clearProjectDocCache } from "./transcript";

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
  count: string; // Note: PostgreSQL COUNT() returns a string natively
}

async function getSession(sessionId: string): Promise<any> {
  const result = await db.query<any>(
    `SELECT s.id, s.meeting_id, s.facilitator_id, s.status, s.started_at, s.ended_at, s.created_at,
            m.duration_minutes
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

function canAccessSession(
  session: SessionRow,
  userId: string,
  role: string,
): boolean {
  if (role === "admin") return true;
  return session.facilitator_id === userId;
}

async function requireAccessibleSession(
  sessionId: string,
  userId: string,
  role: string,
) {
  const session = await getSession(sessionId);

  if (!session) {
    return {
      ok: false as const,
      status: 404,
      error: "Session not found",
    };
  }

  if (!canAccessSession(session, userId, role)) {
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
 * GET /api/session
 *
 * List sessions.
 * - admin: all sessions
 * - facilitator/participant: sessions facilitated by current user
 */
sessionRouter.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.sub;
    const role = req.auth!.role;

    let sessions: SessionWithMeetingRow[];

    if (role === "admin") {
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
        LEFT JOIN meetings m ON m.id = s.meeting_id
        ORDER BY s.created_at DESC
        `,
      );
      sessions = result.rows;
    } else {
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
        LEFT JOIN meetings m ON m.id = s.meeting_id
        WHERE s.facilitator_id = $1
        ORDER BY s.created_at DESC
        `,
        [userId],
      );
      sessions = result.rows;
    }

    res.json({
      ok: true,
      data: {
        sessions,
      },
    });
  } catch (error) {
    console.error("List sessions error:", error);
    res
      .status(500)
      .json({ ok: false, error: "Internal server error retrieving sessions" });
  }
});

/**
 * GET /api/session/active
 *
 * Get the current active session.
 * Useful for meeting recovery and reconnecting the facilitator UI.
 */
sessionRouter.get("/active", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.sub;
    const role = req.auth!.role;

    let session: SessionWithMeetingRow | undefined;

    if (role === "admin") {
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
        LEFT JOIN meetings m ON m.id = s.meeting_id
        WHERE s.status = 'active'
        ORDER BY s.started_at DESC
        LIMIT 1
        `,
      );
      session = result.rows[0];
    } else {
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
        LEFT JOIN meetings m ON m.id = s.meeting_id
        WHERE s.facilitator_id = $1
          AND s.status = 'active'
        ORDER BY s.started_at DESC
        LIMIT 1
        `,
        [userId],
      );
      session = result.rows[0];
    }

    res.json({
      ok: true,
      data: {
        session: session ?? null,
      },
    });
  } catch (error) {
    console.error("Get active session error:", error);
    res
      .status(500)
      .json({
        ok: false,
        error: "Internal server error retrieving active session",
      });
  }
});

/**
 * POST /api/session
 *
 * Create a new session linked to an existing meeting.
 */
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

    if (req.auth!.role !== "admin" && meeting.org_id !== req.auth!.orgId) {
      return res.status(403).json({
        ok: false,
        error: "You cannot create a session for this meeting",
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

/**
 * GET /api/session/recover
 *
 * Recover latest non-ended session after browser/app crash.
 */
sessionRouter.get("/recover", requireAuth, async (req, res) => {
  try {
    const role = req.auth!.role;
    const userId = req.auth!.sub;
    const orgId = req.auth!.orgId;

    if (role === "participant") {
      return res.json({
        ok: true,
        data: {
          recovered: false,
          session: null,
          reason: "participants_do_not_recover_facilitator_sessions",
        },
      });
    }

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
        AND (
          $2 = 'admin'
          OR s.facilitator_id = $3
        )
      ORDER BY
        CASE s.status
          WHEN 'active' THEN 0
          WHEN 'created' THEN 1
          ELSE 2
        END,
        COALESCE(s.started_at, s.created_at) DESC
      LIMIT 1
      `,
      [orgId, role, userId],
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
      },
    });
  } catch (error) {
    console.error("Session recover error:", error);
    res
      .status(500)
      .json({ ok: false, error: "Internal server error recovering session" });
  }
});

/**
 * GET /api/session/:id
 *
 * Get one session and basic linked counts.
 */
sessionRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const accessible = await requireAccessibleSession(
      req.params.id,
      req.auth!.sub,
      req.auth!.role,
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

/**
 * POST /api/session/:id/start
 *
 * Start capture for an existing session.
 */
sessionRouter.post("/:id/start", requireAuth, async (req, res) => {
  try {
    const accessible = await requireAccessibleSession(
      req.params.id,
      req.auth!.sub,
      req.auth!.role,
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

/**
 * POST /api/session/:id/end
 *
 * End a created or active session.
 * This is the Sprint 1 trigger seam for later post-meeting summary generation.
 */
sessionRouter.post("/:id/end", requireAuth, async (req, res) => {
  try {
    const accessible = await requireAccessibleSession(
      req.params.id,
      req.auth!.sub,
      req.auth!.role,
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

    const timestamp = now();

    await db.query(
      `
      UPDATE sessions
      SET status = 'ended',
          started_at = COALESCE(started_at, $1),
          ended_at = COALESCE(ended_at, $2)
      WHERE id = $3
      `,
      [timestamp, timestamp, session.id],
    );

    clearProjectDocCache(session.id);

    const updated = await getSession(session.id);

    // S1-T03-F trigger point.
    // Full post-meeting participant summary generation is implemented later,
    // but ending the session must expose the hook now.
    console.log(`[session:end] session=${session.id} summary trigger stubbed`);

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
