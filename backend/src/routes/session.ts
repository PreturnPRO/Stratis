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

interface SessionWithMeetingRow extends SessionRow {
  meeting_title: string | null;
  project_id: string | null;
}

interface CountRow {
  count: number;
}

function getSession(sessionId: string): SessionRow | undefined {
  return db
    .prepare(
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
      WHERE id = ?
      `
    )
    .get<SessionRow>(sessionId);
}

function getMeeting(meetingId: string): MeetingRow | undefined {
  return db
    .prepare(
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
      WHERE id = ?
      `
    )
    .get<MeetingRow>(meetingId);
}

function canAccessSession(session: SessionRow, userId: string, role: string): boolean {
  if (role === "admin") return true;
  return session.facilitator_id === userId;
}

function requireAccessibleSession(sessionId: string, userId: string, role: string) {
  const session = getSession(sessionId);

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
sessionRouter.get("/", requireAuth, (req, res) => {
  const userId = req.auth!.sub;
  const role = req.auth!.role;

  const sessions =
    role === "admin"
      ? db
          .prepare(
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
            `
          )
          .all<SessionWithMeetingRow>()
      : db
          .prepare(
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
            WHERE s.facilitator_id = ?
            ORDER BY s.created_at DESC
            `
          )
          .all<SessionWithMeetingRow>(userId);

  res.json({
    ok: true,
    data: {
      sessions,
    },
  });
});

/**
 * GET /api/session/active
 *
 * Get the current active session.
 * Useful for meeting recovery and reconnecting the facilitator UI.
 */
sessionRouter.get("/active", requireAuth, (req, res) => {
  const userId = req.auth!.sub;
  const role = req.auth!.role;

  const session =
    role === "admin"
      ? db
          .prepare(
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
            `
          )
          .get<SessionWithMeetingRow>()
      : db
          .prepare(
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
            WHERE s.facilitator_id = ?
              AND s.status = 'active'
            ORDER BY s.started_at DESC
            LIMIT 1
            `
          )
          .get<SessionWithMeetingRow>(userId);

  res.json({
    ok: true,
    data: {
      session: session ?? null,
    },
  });
});

/**
 * POST /api/session
 *
 * Create a new session linked to an existing meeting.
 *
 * Body:
 * {
 *   "meetingId": "mtg_..."
 * }
 */
sessionRouter.post("/", requireAuth, (req, res) => {
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

  const meeting = getMeeting(meetingId);

  if (!meeting) {
    return res.status(404).json({
      ok: false,
      error: "Meeting not found",
    });
  }

  // A meeting belongs to an org; anyone in that org may start a session for it
  // (and becomes its facilitator). Gating on the individual creator denied every
  // account that didn't personally create the meeting (e.g. seeded meetings).
  if (req.auth!.role !== "admin" && meeting.org_id !== req.auth!.orgId) {
    return res.status(403).json({
      ok: false,
      error: "You cannot create a session for this meeting",
    });
  }

  const existingOpenSession = db
    .prepare(
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
      WHERE meeting_id = ?
        AND status IN ('created', 'active')
      LIMIT 1
      `
    )
    .get<SessionRow>(meetingId);

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

  db.prepare(
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
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    sessionId,
    meetingId,
    req.auth!.sub,
    "created",
    null,
    null,
    timestamp
  );

  const session = getSession(sessionId);

  res.status(201).json({
    ok: true,
    data: {
      session,
    },
  });
});

/**
 * GET /api/session/recover
 *
 * Recover latest non-ended session after browser/app crash.
 * Must be before /:id route.
 */
sessionRouter.get("/recover", requireAuth, (req, res) => {
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

  const row = db
    .prepare(
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
        m.title AS meeting_title
      FROM sessions s
      JOIN meetings m ON m.id = s.meeting_id
      WHERE s.status IN ('active', 'created')
        AND m.org_id = ?
        AND (
          ? = 'admin'
          OR s.facilitator_id = ?
        )
      ORDER BY
        CASE s.status
          WHEN 'active' THEN 0
          WHEN 'created' THEN 1
          ELSE 2
        END,
        COALESCE(s.started_at, s.created_at) DESC
      LIMIT 1
      `
    )
    .get(orgId, role, userId);

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
});

/**
 * GET /api/session/:id
 *
 * Get one session and basic linked counts.
 */
sessionRouter.get("/:id", requireAuth, (req, res) => {
  const accessible = requireAccessibleSession(
    req.params.id,
    req.auth!.sub,
    req.auth!.role
  );

  if (!accessible.ok) {
    return res.status(accessible.status).json({
      ok: false,
      error: accessible.error,
    });
  }

  const transcriptCount = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM transcripts
      WHERE session_id = ?
      `
    )
    .get<CountRow>(accessible.session.id);

  const notificationCount = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE session_id = ?
      `
    )
    .get<CountRow>(accessible.session.id);

  res.json({
    ok: true,
    data: {
      session: accessible.session,
      links: {
        transcriptCount: transcriptCount?.count ?? 0,
        notificationCount: notificationCount?.count ?? 0,
      },
    },
  });
});

/**
 * POST /api/session/:id/start
 *
 * Start capture for an existing session.
 */
sessionRouter.post("/:id/start", requireAuth, (req, res) => {
  const accessible = requireAccessibleSession(
    req.params.id,
    req.auth!.sub,
    req.auth!.role
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

  db.prepare(
    `
    UPDATE sessions
    SET status = 'active',
        started_at = COALESCE(started_at, ?)
    WHERE id = ?
    `
  ).run(timestamp, session.id);

  const updated = getSession(session.id);

  res.json({
    ok: true,
    data: {
      session: updated,
    },
  });
});

/**
 * POST /api/session/:id/end
 *
 * End a created or active session.
 * This is the Sprint 1 trigger seam for later post-meeting summary generation.
 */
sessionRouter.post("/:id/end", requireAuth, (req, res) => {
  const accessible = requireAccessibleSession(
    req.params.id,
    req.auth!.sub,
    req.auth!.role
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

  db.prepare(
    `
    UPDATE sessions
    SET status = 'ended',
        started_at = COALESCE(started_at, ?),
        ended_at = COALESCE(ended_at, ?)
    WHERE id = ?
    `
  ).run(timestamp, timestamp, session.id);

  const updated = getSession(session.id);

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
});