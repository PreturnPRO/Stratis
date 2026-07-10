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
  duration_minutes: number | null;
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

// Converted to async using db.query
async function getMeeting(id: string): Promise<MeetingRow | undefined> {
  const result = await db.query<MeetingRow>(
    `
    SELECT id, org_id, project_id, title, goal, brief, duration_minutes, scheduled_at, created_by, created_at
    FROM meetings
    WHERE id = $1
    `,
    [id]
  );
  return result.rows[0];
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

async function listMeetings(req: Request, res: Response) {
  try {
    const limit = parseLimit(req.query.limit);
    const includePast = req.query.includePast === "true";
    const ts = now();

    const params: unknown[] = [req.auth!.orgId];
    const where: string[] = ["m.org_id = $1"];
    let pIdx = 2; // PG parameters are 1-indexed, $1 is used

    if (req.auth!.role === "facilitator") {
      where.push(`m.created_by = $${pIdx++}`);
      params.push(req.auth!.sub);
    }

    if (!includePast) {
      where.push(`(m.scheduled_at IS NULL OR m.scheduled_at >= $${pIdx++})`);
      params.push(ts);
    }

    const limitParam = `$${pIdx}`;
    params.push(limit);

    const result = await db.query<MeetingListRow>(
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
      LIMIT ${limitParam}
      `,
      params
    );

    res.json({
      ok: true,
      data: {
        meetings: result.rows.map(toDashboardMeeting),
      },
    });
  } catch (error) {
    console.error("Error in listMeetings:", error);
    res.status(500).json({ ok: false, error: "Internal server error retrieving meetings" });
  }
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
meetingRouter.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 5, 20);
    const ts = now();

    const meetingParams: unknown[] = [req.auth!.orgId, ts];
    const meetingWhere: string[] = ["m.org_id = $1", "(m.scheduled_at IS NULL OR m.scheduled_at >= $2)"];
    let pIdx = 3;

    if (req.auth!.role === "facilitator") {
      meetingWhere.push(`m.created_by = $${pIdx++}`);
      meetingParams.push(req.auth!.sub);
    }

    const limitParam = `$${pIdx}`;
    meetingParams.push(limit);

    const upcoming = await db.query<MeetingListRow>(
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
      LIMIT ${limitParam}
      `,
      meetingParams
    );

    const activeSession = await db.query<SessionRow>(
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
      WHERE m.org_id = $1
        AND s.status = 'active'
        AND ($2 = 'admin' OR s.facilitator_id = $3)
      ORDER BY s.started_at DESC
      LIMIT 1
      `,
      [req.auth!.orgId, req.auth!.role, req.auth!.sub]
    );

    const recentSummaries = await db.query<SummaryRow>(
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
      WHERE n.user_id = $1
        AND n.kind = 'summary'
      ORDER BY n.created_at DESC
      LIMIT $2
      `,
      [req.auth!.sub, limit]
    );

    res.json({
      ok: true,
      data: {
        upcomingMeetings: upcoming.rows.map(toDashboardMeeting),
        activeSession: activeSession.rows[0] ?? null,
        recentSummaries: recentSummaries.rows,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ ok: false, error: "Internal server error generating dashboard" });
  }
});

/**
 * POST /api/meeting
 */
meetingRouter.post("/", requireAuth, async (req, res) => {
  try {
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

    const rawDuration = req.body?.durationMinutes ?? req.body?.duration_minutes;
    const durationMinutes =
      typeof rawDuration === "number" && Number.isFinite(rawDuration) && rawDuration > 0
        ? Math.min(Math.round(rawDuration), 480)
        : null;

    if (!title) return res.status(400).json({ ok: false, error: "body.title is required" });
    if (!projectId) return res.status(400).json({ ok: false, error: "body.projectId is required" });

    if (scheduledAt && new Date(scheduledAt) < new Date()) {
      return res.status(400).json({ ok: false, error: "Scheduled date cannot be in the past" });
    }

    const id = newId("mtg");
    const timestamp = now();

    await db.query(
      `
      INSERT INTO meetings (
        id, org_id, project_id, title, goal, brief, duration_minutes, scheduled_at, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [id, req.auth!.orgId, projectId, title, goal, brief, durationMinutes, scheduledAt, req.auth!.sub, timestamp]
    );

    const createdMeeting = await getMeeting(id);

    res.status(201).json({
      ok: true,
      data: {
        meeting: createdMeeting,
      },
    });
  } catch (error) {
    console.error("Meeting creation error:", error);
    res.status(500).json({ ok: false, error: "Internal server error creating meeting" });
  }
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
 */
meetingRouter.get("/projects", requireAuth, async (req, res) => {
  try {
    const params: unknown[] = [req.auth!.orgId];
    const where: string[] = ["m.org_id = $1"];
    
    if (req.auth!.role === "facilitator") {
      where.push("m.created_by = $2");
      params.push(req.auth!.sub);
    }
    
    const rows = await db.query<ProjectListRow>(
      `
      SELECT
        m.project_id,
        COUNT(*) AS meeting_count,
        MAX(COALESCE(m.scheduled_at, m.created_at)) AS last_meeting_at
      FROM meetings m
      WHERE ${where.join(" AND ")}
      GROUP BY m.project_id
      ORDER BY last_meeting_at DESC
      `,
      params
    );
    
    res.json({
      ok: true,
      data: {
        projects: rows.rows.map((row) => ({
          id: row.project_id,
          projectId: row.project_id,
          name: titleFromProjectId(row.project_id),
          meetingCount: Number(row.meeting_count ?? 0),
          lastMeetingAt: row.last_meeting_at,
        })),
      },
    });
  } catch (error) {
    console.error("Projects list error:", error);
    res.status(500).json({ ok: false, error: "Internal server error loading projects" });
  }
});

/**
 * POST /api/meeting/projects
 */
meetingRouter.post("/projects", requireAuth, async (req, res) => {
  try {
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
    
    const existing = await db.query<{ project_id: string }>(
      `
      SELECT project_id
      FROM meetings
      WHERE org_id = $1
        AND project_id = $2
      LIMIT 1
      `,
      [req.auth!.orgId, projectId]
    );
    
    if (existing.rows[0]) {
      projectId = `${baseProjectId}-${Date.now().toString(36)}`;
    }
    
    const ts = now();
    const meetingId = newId("mtg");
    const title = `Kickoff: ${name}`;
    
    await db.query(
      `
      INSERT INTO meetings (
        id, org_id, project_id, title, scheduled_at, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [meetingId, req.auth!.orgId, projectId, title, null, req.auth!.sub, ts]
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
  } catch (error) {
    console.error("Project creation error:", error);
    res.status(500).json({ ok: false, error: "Internal server error creating project" });
  }
});

/**
 * GET /api/meeting/:id
 */
meetingRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const meeting = await getMeeting(req.params.id);

    if (!meeting) {
      return res.status(404).json({ ok: false, error: "Meeting not found" });
    }

    if (!canRead(req, meeting)) {
      return res.status(403).json({ ok: false, error: "You do not have access to this meeting" });
    }

    const sessions = await db.query<SessionRow>(
      `
      SELECT id, meeting_id, facilitator_id, status, started_at, ended_at, created_at
      FROM sessions
      WHERE meeting_id = $1
      ORDER BY created_at DESC
      `,
      [meeting.id]
    );

    res.json({
      ok: true,
      data: {
        meeting,
        sessions: sessions.rows,
      },
    });
  } catch (error) {
    console.error("Meeting fetch error:", error);
    res.status(500).json({ ok: false, error: "Internal server error loading meeting" });
  }
});

/**
 * PATCH /api/meeting/:id
 */
meetingRouter.patch("/:id", requireAuth, async (req, res) => {
  try {
    const meeting = await getMeeting(req.params.id);

    if (!meeting) {
      return res.status(404).json({ ok: false, error: "Meeting not found" });
    }

    if (!canManage(req, meeting)) {
      return res.status(403).json({ ok: false, error: "You cannot update this meeting" });
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (typeof req.body?.title === "string") {
      const title = req.body.title.trim();
      if (!title) return res.status(400).json({ ok: false, error: "body.title cannot be empty" });
      updates.push(`title = $${pIdx++}`);
      params.push(title);
    }

    if (typeof req.body?.projectId === "string" || typeof req.body?.project_id === "string") {
      const projectId =
        typeof req.body?.projectId === "string"
          ? req.body.projectId.trim()
          : req.body.project_id.trim();

      if (!projectId) return res.status(400).json({ ok: false, error: "body.projectId cannot be empty" });

      updates.push(`project_id = $${pIdx++}`);
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

      updates.push(`scheduled_at = $${pIdx++}`);
      params.push(scheduledAt);
    }

    for (const field of ["goal", "brief"] as const) {
      if (typeof req.body?.[field] === "string" || req.body?.[field] === null) {
        const value =
          typeof req.body?.[field] === "string" ? req.body[field].trim() || null : null;
        updates.push(`${field} = $${pIdx++}`);
        params.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: "No supported fields provided" });
    }

    params.push(meeting.id);
    const idParam = `$${pIdx}`;

    await db.query(
      `
      UPDATE meetings
      SET ${updates.join(", ")}
      WHERE id = ${idParam}
      `,
      params
    );

    const updatedMeeting = await getMeeting(meeting.id);

    res.json({
      ok: true,
      data: {
        meeting: updatedMeeting,
      },
    });
  } catch (error) {
    console.error("Meeting update error:", error);
    res.status(500).json({ ok: false, error: "Internal server error updating meeting" });
  }
});

/**
 * DELETE /api/meeting/:id
 */
meetingRouter.delete("/:id", requireAuth, async (req, res) => {
  try {
    const meeting = await getMeeting(req.params.id);

    if (!meeting) {
      return res.status(404).json({ ok: false, error: "Meeting not found" });
    }

    if (!canManage(req, meeting)) {
      return res.status(403).json({ ok: false, error: "You cannot delete this meeting" });
    }

    const openSession = await db.query<{ id: string }>(
      `
      SELECT id
      FROM sessions
      WHERE meeting_id = $1
        AND status IN ('created', 'active')
      LIMIT 1
      `,
      [meeting.id]
    );

    if (openSession.rows[0]) {
      return res.status(409).json({
        ok: false,
        error: "Cannot delete a meeting with an open session",
        data: { sessionId: openSession.rows[0].id },
      });
    }

    await db.query(`DELETE FROM meetings WHERE id = $1`, [meeting.id]);

    res.json({
      ok: true,
      data: {
        deleted: true,
        meetingId: meeting.id,
      },
    });
  } catch (error) {
    console.error("Meeting delete error:", error);
    res.status(500).json({ ok: false, error: "Internal server error deleting meeting" });
  }
});