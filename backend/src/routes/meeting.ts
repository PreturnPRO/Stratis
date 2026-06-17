import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";

export const meetingRouter = Router();

type SessionStatus = "created" | "active" | "ended";

interface MeetingRow {
  id: string;
  org_id: string;
  project_id: string;
  title: string;
  goal: string | null;
  brief: string | null;
  scheduled_at: string | null;
  created_by: string | null;
  created_at: string;
}

interface MeetingListRow extends MeetingRow {
  active_session_id: string | null;
  active_session_status: SessionStatus | null;
  session_count: number;
}

interface SessionRow {
  id: string;
  meeting_id: string;
  facilitator_id: string;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface SummaryRow {
  id: string;
  user_id: string;
  session_id: string | null;
  kind: string;
  title: string;
  body: string;
  read: number;
  created_at: string;
  meeting_title: string | null;
  project_id: string | null;
}

function parseLimit(value: unknown, fallback = 10, max = 50): number {
  const n = typeof value === "string" ? Number(value) : fallback;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function getMeeting(id: string): MeetingRow | undefined {
  return db
    .prepare(
      `
      SELECT id, org_id, project_id, title, goal, brief, scheduled_at, created_by, created_at
      FROM meetings
      WHERE id = ?
      `
    )
    .get<MeetingRow>(id);
}

function canRead(req: Request, meeting: MeetingRow): boolean {
  if (!req.auth) return false;
  if (meeting.org_id !== req.auth.orgId) return false;
  if (req.auth.role === "admin") return true;
  if (req.auth.role === "participant") return true;
  return meeting.created_by === req.auth.sub;
}

function canManage(req: Request, meeting: MeetingRow): boolean {
  if (!req.auth) return false;
  if (meeting.org_id !== req.auth.orgId) return false;
  if (req.auth.role === "admin") return true;
  return meeting.created_by === req.auth.sub;
}

function toDashboardMeeting(row: MeetingListRow) {
  return {
    id: row.id,
    title: row.title,
    projectId: row.project_id,
    project: row.project_id,
    scheduledAt: row.scheduled_at,
    time: row.scheduled_at,
    participantCount: 0,
    participants: 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    sessionCount: row.session_count ?? 0,
    activeSession:
      row.active_session_id && row.active_session_status
        ? { id: row.active_session_id, status: row.active_session_status }
        : null,
  };
}

function listMeetings(req: Request, res: Response) {
  const limit = parseLimit(req.query.limit);
  const includePast = req.query.includePast === "true";
  const ts = now();

  const where: string[] = ["m.org_id = ?"];
  const params: unknown[] = [req.auth!.orgId];

  if (req.auth!.role === "facilitator") {
    where.push("m.created_by = ?");
    params.push(req.auth!.sub);
  }

  if (!includePast) {
    where.push("(m.scheduled_at IS NULL OR m.scheduled_at >= ?)");
    params.push(ts);
  }

  params.push(limit);

  const rows = db
    .prepare(
      `
      SELECT
        m.id,
        m.org_id,
        m.project_id,
        m.title,
        m.scheduled_at,
        m.created_by,
        m.created_at,

        (
          SELECT s.id
          FROM sessions s
          WHERE s.meeting_id = m.id
            AND s.status IN ('created', 'active')
          ORDER BY
            CASE s.status
              WHEN 'active' THEN 0
              WHEN 'created' THEN 1
              ELSE 2
            END,
            s.created_at DESC
          LIMIT 1
        ) AS active_session_id,

        (
          SELECT s.status
          FROM sessions s
          WHERE s.meeting_id = m.id
            AND s.status IN ('created', 'active')
          ORDER BY
            CASE s.status
              WHEN 'active' THEN 0
              WHEN 'created' THEN 1
              ELSE 2
            END,
            s.created_at DESC
          LIMIT 1
        ) AS active_session_status,

        (
          SELECT COUNT(*)
          FROM sessions s
          WHERE s.meeting_id = m.id
        ) AS session_count

      FROM meetings m
      WHERE ${where.join(" AND ")}
      ORDER BY
        CASE WHEN m.scheduled_at IS NULL THEN 1 ELSE 0 END,
        m.scheduled_at ASC,
        m.created_at DESC
      LIMIT ?
      `
    )
    .all<MeetingListRow>(...params);

  res.json({
    ok: true,
    data: {
      meetings: rows.map(toDashboardMeeting),
    },
  });
}

/**
 * GET /api/meeting
 * Dashboard upcoming meetings.
 */
meetingRouter.get("/", requireAuth, listMeetings);

/**
 * GET /api/meeting/upcoming
 */
meetingRouter.get("/upcoming", requireAuth, listMeetings);

/**
 * GET /api/meeting/dashboard
 * One-call dashboard payload.
 */
meetingRouter.get("/dashboard", requireAuth, (req, res) => {
  const limit = parseLimit(req.query.limit, 5, 20);
  const ts = now();

  const meetingWhere: string[] = ["m.org_id = ?", "(m.scheduled_at IS NULL OR m.scheduled_at >= ?)"];
  const meetingParams: unknown[] = [req.auth!.orgId, ts];

  if (req.auth!.role === "facilitator") {
    meetingWhere.push("m.created_by = ?");
    meetingParams.push(req.auth!.sub);
  }

  meetingParams.push(limit);

  const upcoming = db
    .prepare(
      `
      SELECT
        m.id,
        m.org_id,
        m.project_id,
        m.title,
        m.scheduled_at,
        m.created_by,
        m.created_at,

        (
          SELECT s.id
          FROM sessions s
          WHERE s.meeting_id = m.id
            AND s.status IN ('created', 'active')
          ORDER BY s.created_at DESC
          LIMIT 1
        ) AS active_session_id,

        (
          SELECT s.status
          FROM sessions s
          WHERE s.meeting_id = m.id
            AND s.status IN ('created', 'active')
          ORDER BY s.created_at DESC
          LIMIT 1
        ) AS active_session_status,

        (
          SELECT COUNT(*)
          FROM sessions s
          WHERE s.meeting_id = m.id
        ) AS session_count

      FROM meetings m
      WHERE ${meetingWhere.join(" AND ")}
      ORDER BY
        CASE WHEN m.scheduled_at IS NULL THEN 1 ELSE 0 END,
        m.scheduled_at ASC,
        m.created_at DESC
      LIMIT ?
      `
    )
    .all<MeetingListRow>(...meetingParams);

  const activeSession = db
    .prepare(
      `
      SELECT
        s.id,
        s.meeting_id,
        s.facilitator_id,
        s.status,
        s.started_at,
        s.ended_at,
        s.created_at
      FROM sessions s
      JOIN meetings m ON m.id = s.meeting_id
      WHERE m.org_id = ?
        AND s.status = 'active'
        AND (? = 'admin' OR s.facilitator_id = ?)
      ORDER BY s.started_at DESC
      LIMIT 1
      `
    )
    .get<SessionRow>(req.auth!.orgId, req.auth!.role, req.auth!.sub);

  const recentSummaries = db
    .prepare(
      `
      SELECT
        n.id,
        n.user_id,
        n.session_id,
        n.kind,
        n.title,
        n.body,
        n.read,
        n.created_at,
        m.title AS meeting_title,
        m.project_id AS project_id
      FROM notifications n
      LEFT JOIN sessions s ON s.id = n.session_id
      LEFT JOIN meetings m ON m.id = s.meeting_id
      WHERE n.user_id = ?
        AND n.kind = 'summary'
      ORDER BY n.created_at DESC
      LIMIT ?
      `
    )
    .all<SummaryRow>(req.auth!.sub, limit);

  res.json({
    ok: true,
    data: {
      upcomingMeetings: upcoming.map(toDashboardMeeting),
      activeSession: activeSession ?? null,
      recentSummaries,
    },
  });
});

/**
 * POST /api/meeting
 */
meetingRouter.post("/", requireAuth, (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";

  const projectId =
    typeof req.body?.projectId === "string"
      ? req.body.projectId.trim()
      : typeof req.body?.project_id === "string"
        ? req.body.project_id.trim()
        : "";

  const scheduledAt =
    typeof req.body?.scheduledAt === "string"
      ? req.body.scheduledAt
      : typeof req.body?.scheduled_at === "string"
        ? req.body.scheduled_at
        : null;

  const goal = typeof req.body?.goal === "string" ? req.body.goal.trim() || null : null;
  const brief = typeof req.body?.brief === "string" ? req.body.brief.trim() || null : null;

  if (!title) return res.status(400).json({ ok: false, error: "body.title is required" });
  if (!projectId) return res.status(400).json({ ok: false, error: "body.projectId is required" });

  const id = newId("mtg");
  const timestamp = now();

  db.prepare(
    `
    INSERT INTO meetings (
      id,
      org_id,
      project_id,
      title,
      goal,
      brief,
      scheduled_at,
      created_by,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(id, req.auth!.orgId, projectId, title, goal, brief, scheduledAt, req.auth!.sub, timestamp);

  res.status(201).json({
    ok: true,
    data: {
      meeting: getMeeting(id),
    },
  });
});

interface ProjectListRow {
  project_id: string;
  meeting_count: number;
  last_meeting_at: string | null;
}

function slugifyProjectName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function titleFromProjectId(projectId: string): string {
  return projectId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * GET /api/meeting/projects
 *
 * Sprint 1 MVP project list.
 * There is no full projects table yet, so projects are derived from meetings.project_id.
 */
meetingRouter.get("/projects", requireAuth, (req, res) => {
  const where: string[] = ["m.org_id = ?"];
  const params: unknown[] = [req.auth!.orgId];
  if (req.auth!.role === "facilitator") {
    where.push("m.created_by = ?");
    params.push(req.auth!.sub);
  }
  const rows = db
    .prepare(
      `
      SELECT
        m.project_id,
        COUNT(*) AS meeting_count,
        MAX(COALESCE(m.scheduled_at, m.created_at)) AS last_meeting_at
      FROM meetings m
      WHERE ${where.join(" AND ")}
      GROUP BY m.project_id
      ORDER BY last_meeting_at DESC
      `
    )
    .all<ProjectListRow>(...params);
  res.json({
    ok: true,
    data: {
      projects: rows.map((row) => ({
        id: row.project_id,
        projectId: row.project_id,
        name: titleFromProjectId(row.project_id),
        meetingCount: Number(row.meeting_count ?? 0),
        lastMeetingAt: row.last_meeting_at,
      })),
    },
  });
});

/**
 * POST /api/meeting/projects
 *
 * Sprint 1 MVP new project.
 * Creates a starter meeting under a new project_id.
 */
meetingRouter.post("/projects", requireAuth, (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    return res.status(400).json({
      ok: false,
      error: "Project name is required",
    });
  }
  const baseProjectId = slugifyProjectName(name);
  if (!baseProjectId) {
    return res.status(400).json({
      ok: false,
      error: "Project name must contain letters or numbers",
    });
  }
  let projectId = baseProjectId;
  const existing = db
    .prepare(
      `
      SELECT project_id
      FROM meetings
      WHERE org_id = ?
        AND project_id = ?
      LIMIT 1
      `
    )
    .get<{ project_id: string }>(req.auth!.orgId, projectId);
  if (existing) {
    projectId = `${baseProjectId}-${Date.now().toString(36)}`;
  }
  const ts = now();
  const meetingId = newId("mtg");
  const title = `Kickoff: ${name}`;
  db.prepare(
    `
    INSERT INTO meetings (
      id,
      org_id,
      project_id,
      title,
      scheduled_at,
      created_by,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    meetingId,
    req.auth!.orgId,
    projectId,
    title,
    null,
    req.auth!.sub,
    ts
  );
  res.status(201).json({
    ok: true,
    data: {
      project: {
        id: projectId,
        projectId,
        name,
        meetingCount: 1,
        lastMeetingAt: ts,
      },
      meeting: {
        id: meetingId,
        projectId,
        title,
        scheduledAt: null,
        createdAt: ts,
      },
    },
  });
});

/**
 * GET /api/meeting/:id
 */
meetingRouter.get("/:id", requireAuth, (req, res) => {
  const meeting = getMeeting(req.params.id);

  if (!meeting) {
    return res.status(404).json({ ok: false, error: "Meeting not found" });
  }

  if (!canRead(req, meeting)) {
    return res.status(403).json({ ok: false, error: "You do not have access to this meeting" });
  }

  const sessions = db
    .prepare(
      `
      SELECT id, meeting_id, facilitator_id, status, started_at, ended_at, created_at
      FROM sessions
      WHERE meeting_id = ?
      ORDER BY created_at DESC
      `
    )
    .all<SessionRow>(meeting.id);

  res.json({
    ok: true,
    data: {
      meeting,
      sessions,
    },
  });
});

/**
 * PATCH /api/meeting/:id
 */
meetingRouter.patch("/:id", requireAuth, (req, res) => {
  const meeting = getMeeting(req.params.id);

  if (!meeting) {
    return res.status(404).json({ ok: false, error: "Meeting not found" });
  }

  if (!canManage(req, meeting)) {
    return res.status(403).json({ ok: false, error: "You cannot update this meeting" });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (typeof req.body?.title === "string") {
    const title = req.body.title.trim();
    if (!title) return res.status(400).json({ ok: false, error: "body.title cannot be empty" });
    updates.push("title = ?");
    params.push(title);
  }

  if (typeof req.body?.projectId === "string" || typeof req.body?.project_id === "string") {
    const projectId =
      typeof req.body?.projectId === "string"
        ? req.body.projectId.trim()
        : req.body.project_id.trim();

    if (!projectId) return res.status(400).json({ ok: false, error: "body.projectId cannot be empty" });

    updates.push("project_id = ?");
    params.push(projectId);
  }

  if (
    typeof req.body?.scheduledAt === "string" ||
    typeof req.body?.scheduled_at === "string" ||
    req.body?.scheduledAt === null ||
    req.body?.scheduled_at === null
  ) {
    const scheduledAt =
      req.body?.scheduledAt === null || req.body?.scheduled_at === null
        ? null
        : typeof req.body?.scheduledAt === "string"
          ? req.body.scheduledAt
          : req.body.scheduled_at;

    updates.push("scheduled_at = ?");
    params.push(scheduledAt);
  }

  for (const field of ["goal", "brief"] as const) {
    if (typeof req.body?.[field] === "string" || req.body?.[field] === null) {
      const value =
        typeof req.body?.[field] === "string" ? req.body[field].trim() || null : null;
      updates.push(`${field} = ?`);
      params.push(value);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ ok: false, error: "No supported fields provided" });
  }

  params.push(meeting.id);

  db.prepare(
    `
    UPDATE meetings
    SET ${updates.join(", ")}
    WHERE id = ?
    `
  ).run(...params);

  res.json({
    ok: true,
    data: {
      meeting: getMeeting(meeting.id),
    },
  });
});

/**
 * DELETE /api/meeting/:id
 */
meetingRouter.delete("/:id", requireAuth, (req, res) => {
  const meeting = getMeeting(req.params.id);

  if (!meeting) {
    return res.status(404).json({ ok: false, error: "Meeting not found" });
  }

  if (!canManage(req, meeting)) {
    return res.status(403).json({ ok: false, error: "You cannot delete this meeting" });
  }

  const openSession = db
    .prepare(
      `
      SELECT id
      FROM sessions
      WHERE meeting_id = ?
        AND status IN ('created', 'active')
      LIMIT 1
      `
    )
    .get<{ id: string }>(meeting.id);

  if (openSession) {
    return res.status(409).json({
      ok: false,
      error: "Cannot delete a meeting with an open session",
      data: { sessionId: openSession.id },
    });
  }

  db.prepare(`DELETE FROM meetings WHERE id = ?`).run(meeting.id);

  res.json({
    ok: true,
    data: {
      deleted: true,
      meetingId: meeting.id,
    },
  });
});