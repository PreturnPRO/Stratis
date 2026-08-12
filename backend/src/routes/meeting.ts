import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { enforceMeetingQuota } from "../lib/entitlements";

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

/** A row of participant_summaries, joined out to the meeting it summarises. */
interface SummaryRow {
  id: string;
  session_id: string;
  title: string;
  created_at: string;
  meeting_title: string | null;
  project_id: string | null;
  project_name: string | null;
}

function isIdentityFkViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23503";
}

function replyIdentityGone(res: Response) {
  return res.status(401).json({
    ok: false,
    error: "Your session references an account that no longer exists — please log in again",
  });
}

function parseLimit(value: unknown, fallback = 10, max = 50): number {
  const n = typeof value === "string" ? Number(value) : fallback;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

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
  // Editing and deleting a meeting belongs to whoever scheduled it. An admin
  // manages the workspace, not other people's agendas.
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
    let pIdx = 2;

    if (req.auth!.role === "facilitator") {
      where.push(`m.created_by = $${pIdx++}`);
      params.push(req.auth!.sub);
    }

    if (!includePast) {
      where.push(`(m.scheduled_at IS NULL OR m.scheduled_at >= $${pIdx++})`);
      params.push(ts);
      // A meeting that has already been run is past, whether or not it ever
      // carried a date. Same rule as the dashboard's "Ready to start".
      where.push(`(
        EXISTS (
          SELECT 1 FROM sessions s_live
          WHERE s_live.meeting_id = m.id AND s_live.status IN ('created', 'active')
        )
        OR NOT EXISTS (SELECT 1 FROM sessions s_any WHERE s_any.meeting_id = m.id)
      )`);
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

meetingRouter.get("/", requireAuth, listMeetings);

meetingRouter.get("/upcoming", requireAuth, listMeetings);

meetingRouter.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 5, 20);
    const ts = now();

    const meetingParams: unknown[] = [req.auth!.orgId, ts];
    const meetingWhere: string[] = [
      "m.org_id = $1",
      "(m.scheduled_at IS NULL OR m.scheduled_at >= $2)",
      // "Ready to start" means exactly that: never run, or holding a session
      // that has not ended. Without this an ad-hoc meeting stayed on the list
      // for ever, so the panel filled with meetings that had already happened —
      // one of them four times over — and the facilitator had to remember which
      // of them was real.
      `(
        EXISTS (
          SELECT 1 FROM sessions s_live
          WHERE s_live.meeting_id = m.id AND s_live.status IN ('created', 'active')
        )
        OR NOT EXISTS (SELECT 1 FROM sessions s_any WHERE s_any.meeting_id = m.id)
      )`,
    ];
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
        AND s.facilitator_id = $2
      ORDER BY s.started_at DESC
      LIMIT 1
      `,
      [req.auth!.orgId, req.auth!.sub]
    );

    // Read the summaries table, not the notification feed.
    //
    // This used to select notifications WHERE kind = 'summary', but a document
    // commit also files a kind='summary' notification (see routes/document.ts),
    // so "Recent summaries" listed rows titled "<meeting> — document v3" and
    // every one of them opened the SUMMARY page. That is the wrong destination
    // for a document card, and where a notification's session had been deleted
    // (session_id is ON DELETE SET NULL) the card carried no session id at all
    // and the click 404'd.
    //
    // Scoped org + facilitator to match getSessionForSummary in routes/summary.ts,
    // so a card that renders here can always be opened by whoever sees it.
    const recentSummaries = await db.query<SummaryRow>(
      `
      SELECT
        ps.id,
        ps.session_id,
        ps.summary_title AS title,
        ps.created_at,
        m.title  AS meeting_title,
        m.project_id AS project_id,
        -- Same reason as the docket: the card said "stratis1" where the rest
        -- of the app says "Stratis1".
        COALESCE(p.name, m.project_id) AS project_name
      FROM participant_summaries ps
      JOIN sessions s ON s.id = ps.session_id
      JOIN meetings m ON m.id = s.meeting_id
      LEFT JOIN projects p ON p.id = m.project_id
      WHERE m.org_id = $1
        AND s.facilitator_id = $2
      ORDER BY ps.created_at DESC
      LIMIT $3
      `,
      [req.auth!.orgId, req.auth!.sub, limit]
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

meetingRouter.post("/", requireAuth, enforceMeetingQuota, async (req, res) => {
  try {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const projectId = typeof req.body?.projectId === "string" ? req.body.projectId.trim() : typeof req.body?.project_id === "string" ? req.body.project_id.trim() : "";
    const scheduledAt = typeof req.body?.scheduledAt === "string" ? req.body.scheduledAt : typeof req.body?.scheduled_at === "string" ? req.body.scheduled_at : null;
    const goal = typeof req.body?.goal === "string" ? req.body.goal.trim() || null : null; 
    const brief = typeof req.body?.brief === "string" ? req.body.brief.trim() || null : null;

    const rawDuration = req.body?.durationMinutes ?? req.body?.duration_minutes; 
    const durationMinutes = typeof rawDuration === "number" && Number.isFinite(rawDuration) && rawDuration > 0 ? Math.min(Math.round(rawDuration), 480) : null;

    if (!title) return res.status(400).json({ ok: false, error: "body.title is required" }); 
    if (!projectId) return res.status(400).json({ ok: false, error: "body.projectId is required" });

    if (scheduledAt && new Date(scheduledAt) < new Date()) { 
      return res.status(400).json({ ok: false, error: "Scheduled date cannot be in the past" }); 
    }

    const projectCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND org_id = $2 LIMIT 1",
      [projectId, req.auth!.orgId]
    );

    if (projectCheck.rows.length === 0) {
      const projectName = titleFromProjectId(projectId);
      const ts = now();
      await db.query(
        `INSERT INTO projects (id, org_id, name, slug, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [projectId, req.auth!.orgId, projectName, projectId, ts, ts]
      );
    }

    const id = newId("mtg"); 
    const timestamp = now();

    await db.query(
      `INSERT INTO meetings (
        id, org_id, project_id, title, goal, brief, duration_minutes, scheduled_at, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, req.auth!.orgId, projectId, title, goal, brief, durationMinutes, scheduledAt, req.auth!.sub, timestamp]
    );

    const createdMeeting = await getMeeting(id);

    res.status(201).json({ ok: true, data: { meeting: createdMeeting } }); 
  } catch (error) {
    console.error("Meeting creation error:", error);
    if (isIdentityFkViolation(error)) return replyIdentityGone(res);
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

interface DocketMeetingRow {
  id: string;
  title: string;
  project_id: string;
  project_name: string | null;
  goal: string | null;
  duration_minutes: number | null;
  scheduled_at: string | null;
  created_at: string;
  active_session_id: string | null;
  active_session_status: SessionStatus | null;
}

interface WaitingRow {
  id: string;
  session_id: string;
  text: string;
  status: "open" | "incomplete";
  owner: string | null;
  missing: string | null;
  source_meeting: string | null;
  source_meeting_id: string;
  source_at: string;
  project_id: string | null;
  project_name: string | null;
  since: string;
  total_count: string;
}

/**
 * How many unresolved decisions one docket request may carry.
 *
 * The page used to ask for every open question in the org on every visit — 200
 * rows and their joins whether or not anyone scrolled that far. A workspace a
 * year in pays that on every navigation. The default page is what fits on the
 * screen; `limit` raises it when the reader asks for more, and the hard cap is
 * what stops a crafted query pulling the whole table.
 */
const OPEN_ITEM_PAGE = 25;
const OPEN_ITEM_MAX = 200;

meetingRouter.get("/docket", requireAuth, async (req, res) => {
  try {
    const orgId = req.auth!.orgId;
    const ts = now();
    const openLimit = parseLimit(req.query.limit, OPEN_ITEM_PAGE, OPEN_ITEM_MAX);
    // One project at a time is how the questions are actually read: they belong
    // to different documents and mixing them is what makes the list unreadable.
    const projectFilter =
      typeof req.query.project === "string" && req.query.project.trim()
        ? req.query.project.trim()
        : null;

    const meetingsResult = await db.query<DocketMeetingRow>(
      `
      SELECT
        m.id,
        m.title,
        m.project_id,
        COALESCE(p.name, m.project_id) AS project_name,
        m.goal,
        m.duration_minutes,
        m.scheduled_at,
        m.created_at,
        live.id     AS active_session_id,
        live.status AS active_session_status
      FROM meetings m
      LEFT JOIN projects p ON p.id = m.project_id
      LEFT JOIN LATERAL (
        SELECT s.id, s.status
        FROM sessions s
        WHERE s.meeting_id = m.id AND s.status = 'active'
        ORDER BY s.started_at DESC NULLS LAST
        LIMIT 1
      ) live ON TRUE
      WHERE m.org_id = $1
        AND (
          (m.scheduled_at IS NOT NULL AND m.scheduled_at >= $2)
          OR live.id IS NOT NULL
        )
      ORDER BY
        CASE WHEN live.id IS NOT NULL THEN 0 ELSE 1 END,
        m.scheduled_at ASC NULLS LAST,
        m.created_at ASC
      LIMIT 50
      `,
      [orgId, ts],
    );

    // Every unresolved decision in the org, oldest first. This list drives both
    // the "Awaiting a date" band and the per-meeting carried-thread counts, so
    // a badge can never disagree with the items behind it.
    //
    // It used to be filtered by NOT EXISTS (any upcoming meeting on the same
    // project), which hid an open question the moment ANY meeting was booked on
    // its project — not one that addressed it. A team with a weekly sync per
    // project saw the band permanently empty while open items piled up: the
    // more you scheduled, the less you were shown.
    const waitingResult = await db.query<WaitingRow>(
      `
      SELECT
        d.id,
        d.session_id,
        d.text,
        d.status,
        d.owner,
        d.missing,
        dm.title      AS source_meeting,
        dm.id         AS source_meeting_id,
        dm.project_id AS project_id,
        -- The slug is not a name. "testing-the-sound-for-stratis" is what the
        -- row used to show, on a list whose whole job is telling two projects
        -- apart at a glance.
        COALESCE(p.name, dm.project_id) AS project_name,
        COALESCE(dm.scheduled_at, dm.created_at) AS source_at,
        d.created_at  AS since,
        COUNT(*) OVER () AS total_count
      FROM decisions d
      JOIN meetings dm ON dm.id = d.meeting_id
      LEFT JOIN projects p ON p.id = dm.project_id
      WHERE dm.org_id = $1
        AND ($2::text IS NULL OR dm.project_id = $2)
        AND d.dismissed = FALSE
        -- Ticked off counts as resolved here even though the status column is
        -- untouched: this list answers "what still needs deciding", and a
        -- question whose work is finished does not. Without this, Mark done
        -- wrote to the database and the row stayed exactly where it was.
        AND d.done_at IS NULL
        AND d.status IN ('open', 'incomplete')
      ORDER BY d.created_at ASC
      LIMIT $3
      `,
      [orgId, projectFilter, openLimit],
    );

    /**
     * The filter's own row: one line per project with open questions, so the
     * chips can be drawn without fetching the questions themselves. Counting in
     * the database is what keeps this cheap — the alternative was shipping
     * every row to the client and counting there, which is the thing being
     * fixed.
     */
    const projectSummary = await db.query<{ id: string; name: string | null; open_count: string }>(
      `
      SELECT
        dm.project_id AS id,
        COALESCE(p.name, dm.project_id) AS name,
        COUNT(*) AS open_count
      FROM decisions d
      JOIN meetings dm ON dm.id = d.meeting_id
      LEFT JOIN projects p ON p.id = dm.project_id
      WHERE dm.org_id = $1
        AND d.dismissed = FALSE
        AND d.done_at IS NULL
        AND d.status IN ('open', 'incomplete')
      GROUP BY dm.project_id, p.name
      ORDER BY COUNT(*) DESC
      LIMIT 12
      `,
      [orgId],
    );

    res.json({
      ok: true,
      data: {
        meetings: meetingsResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          projectId: row.project_id,
          projectName: row.project_name,
          goal: row.goal,
          durationMinutes: row.duration_minutes,
          scheduledAt: row.scheduled_at,
          createdAt: row.created_at,
          activeSession:
            row.active_session_id && row.active_session_status
              ? { id: row.active_session_id, status: row.active_session_status }
              : null,
        })),
        projectFilter,
        openLimit,
        projects: projectSummary.rows.map((row) => ({
          id: row.id,
          name: row.name ?? row.id,
          openCount: Number(row.open_count),
        })),
        waiting: waitingResult.rows.map((row) => ({
          id: row.id,
          // The decision PATCH is scoped to its session, so the row has to
          // carry it or the Docket cannot resolve what it displays.
          sessionId: row.session_id,
          text: row.text,
          status: row.status,
          owner: row.owner,
          missing: row.missing,
          sourceMeeting: row.source_meeting,
          sourceMeetingId: row.source_meeting_id,
          sourceAt: row.source_at,
          projectId: row.project_id,
          projectName: row.project_name,
          since: row.since,
        })),
        // Total before the cap, so the UI can say when it is showing a slice.
        waitingTotal: Number(waitingResult.rows[0]?.total_count ?? 0),
      },
    });
  } catch (error) {
    console.error("Docket load error:", error);
    if (isIdentityFkViolation(error)) return replyIdentityGone(res);
    res.status(500).json({ ok: false, error: "Could not load the docket" });
  }
});

meetingRouter.get("/:id/ics", requireAuth, async (req, res) => {
  try {
    const meeting = await getMeeting(req.params.id);
    if (!meeting || meeting.org_id !== req.auth!.orgId) {
      return res.status(404).json({ ok: false, error: "Meeting not found" });
    }
    if (!meeting.scheduled_at) {
      return res.status(409).json({ ok: false, error: "This meeting has no scheduled time" });
    }

    const start = new Date(meeting.scheduled_at);
    const end = new Date(start.getTime() + (meeting.duration_minutes ?? 60) * 60_000);
    const stamp = (d: Date) => `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
    const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Stratis//Docket//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${meeting.id}@stratis`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(meeting.title)}`,
      ...(meeting.goal ? [`DESCRIPTION:${esc(`Goal: ${meeting.goal}`)}`] : []),
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${meeting.id}.ics"`);
    res.send(lines.join("\r\n"));
  } catch (error) {
    console.error("ICS export error:", error);
    res.status(500).json({ ok: false, error: "Could not build the calendar file" });
  }
});

meetingRouter.get("/projects", requireAuth, async (req, res) => {
  try {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.sub;
    const role = req.auth!.role;

    const params: unknown[] = [orgId];
    let meetingQueryFilter = "m.org_id = $1";

    if (role === "facilitator") {
      meetingQueryFilter += " AND m.created_by = $2";
      params.push(userId);
    }

    const rows = await db.query<{
      id: string;
      name: string;
      slug: string;
      meeting_count: string;
      last_meeting_at: string | null;
    }>(
      `SELECT p.id, p.name, p.slug, 
              COUNT(m.id) AS meeting_count, 
              MAX(COALESCE(m.scheduled_at, m.created_at)) AS last_meeting_at
       FROM projects p
       LEFT JOIN meetings m ON m.project_id = p.id AND ${meetingQueryFilter}
       WHERE p.org_id = $1
       GROUP BY p.id, p.name, p.slug
       ORDER BY last_meeting_at DESC NULLS LAST, p.created_at DESC`,
      params
    );

    res.json({
      ok: true,
      data: {
        projects: rows.rows.map((row) => ({
          id: row.id,
          projectId: row.id,
          name: row.name,
          meetingCount: Number(row.meeting_count ?? 0),
          lastMeetingAt: row.last_meeting_at,
        })),
      },
    });
  } catch (error) {
    console.error("Projects list retrieval error:", error);
    res.status(500).json({ ok: false, error: "Internal server error loading projects" });
  }
});

meetingRouter.post("/projects", requireAuth, async (req, res) => {
  try {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.sub;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!name) {
      return res.status(400).json({ ok: false, error: "Project name is required" });
    }

    const baseSlug = slugifyProjectName(name);
    if (!baseSlug) {
      return res.status(400).json({ ok: false, error: "Project name must contain letters or numbers" });
    }

    let slug = baseSlug;
    const existing = await db.query<{ slug: string }>(
      "SELECT slug FROM projects WHERE org_id = $1 AND slug = $2 LIMIT 1",
      [orgId, slug]
    );

    if (existing.rows.length > 0) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const ts = now();
    const projectId = newId("prj");
    const meetingId = newId("mtg");
    const title = `Kickoff: ${name}`;

    await db.query(
      `INSERT INTO projects (id, org_id, name, slug, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [projectId, orgId, name, slug, ts, ts]
    );

    await db.query(
      `INSERT INTO meetings (id, org_id, project_id, title, duration_minutes, scheduled_at, created_by, created_at)
       VALUES ($1, $2, $3, $4, 60, null, $5, $6)`,
      [meetingId, orgId, projectId, title, userId, ts]
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
    console.error("Project database creation error:", error);
    if (isIdentityFkViolation(error)) return replyIdentityGone(res);
    res.status(500).json({ ok: false, error: "Internal server error creating project" });
  }
});

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
