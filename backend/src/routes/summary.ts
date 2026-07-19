// /api/summary
//
// Honest summary: generated ONCE (session-end hook, or lazily on first view for
// older sessions) and persisted by lib/summaryStore. This route serves the
// stored record plus the session's decisions joined live from the decisions
// table, so checkpoint edits show up and the ratified summary never silently
// changes between page views.

import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { getStoredSummary, generateAndSaveSummary } from "../lib/summaryStore";
import { getDecisions, completenessFromRecords } from "../lib/decisions";

export const summaryRouter = Router();

interface SessionSummaryRow {
  id: string;
  meeting_id: string;
  facilitator_id: string;
  status: "created" | "active" | "ended";
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  meeting_title: string;
  project_id: string;
  org_id: string;
}

interface SummaryBlock {
  block_type:
    | "OVERVIEW"
    | "WHAT_CHANGED"
    | "DECISIONS"
    | "OPEN_ITEMS"
    | "ASSUMPTIONS"
    | "RISKS"
    | "ACTION_ITEMS"
    | "NEXT_STEPS";
  title: string;
  content: string;
  visible_to_participants: boolean;
}

interface ActionItem {
  task: string;
  owner: string;
  due_date: string | null;
}

interface ParticipantSummaryOutput {
  output_type: "participant_summary_output";
  session_id: string;
  summary_title: string;
  summary_subtitle: string;
  participants: string[];
  duration_minutes: number;
  summary_blocks: SummaryBlock[];
  action_items: ActionItem[];
}

async function getSessionForSummary(
  sessionId: string,
  userId: string,
  orgId: string,
  role: string,
): Promise<SessionSummaryRow | undefined> {
  const result = await db.query<SessionSummaryRow>(
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
      m.project_id AS project_id,
      m.org_id AS org_id
    FROM sessions s
    JOIN meetings m ON m.id = s.meeting_id
    WHERE s.id = $1
      AND m.org_id = $2
      AND ($3 = 'admin' OR s.facilitator_id = $4)
    `,
    [sessionId, orgId, role, userId]
  );
  return result.rows[0];
}


summaryRouter.get("/", requireAuth, (_req, res) => {
  res.json({
    ok: true,
    data: {
      namespace: "summary",
      status: "ready",
      routes: ["GET /api/summary/:sessionId"],
    },
  });
});

summaryRouter.get("/:sessionId", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;

    const session = await getSessionForSummary(
      sessionId,
      req.auth!.sub,
      req.auth!.orgId,
      req.auth!.role,
    );

    if (!session) {
      return res.status(404).json({
        ok: false,
        error: "Session not found or you do not have access",
      });
    }

    // Serve the stored summary — generated once at session end. Sessions ended
    // before persistence existed (or whose end-hook failed) lazily generate and
    // store here, once; every later view is a fast DB read. The summary a team
    // ratified must not silently change per page view.
    let stored = await getStoredSummary(sessionId);
    if (!stored) {
      stored = await generateAndSaveSummary(sessionId);
    }
    if (!stored) {
      return res.status(409).json({
        ok: false,
        error: "No transcript rows found for this session",
      });
    }

    // Decisions join live (not snapshotted) so facilitator checkpoint edits
    // after the meeting show up — the decisions table is the verified record.
    // Dismissed rows are rejected extractions; the summary never shows them.
    const decisions = (await getDecisions(sessionId)).filter((d) => !d.dismissed);

    const summary: ParticipantSummaryOutput = {
      output_type: "participant_summary_output",
      session_id: session.id,
      summary_title: stored.summaryTitle,
      summary_subtitle: stored.summarySubtitle,
      participants: stored.participants,
      duration_minutes: stored.durationMinutes,
      summary_blocks: stored.blocks as SummaryBlock[],
      action_items: [],
    };

    res.json({
      ok: true,
      data: {
        summary,
        decisions,
        metric: completenessFromRecords(decisions),
        provider: stored.provider ?? "stored",
        transcriptCount: stored.blocks.length,
      },
    });
  } catch (err) {
    next(err);
  }
});