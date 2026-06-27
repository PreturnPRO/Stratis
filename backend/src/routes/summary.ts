// /api/summary
//
// MVP summary generation:
// End meeting -> SummaryView fetches GET /api/summary/:sessionId
// -> backend loads saved transcript rows
// -> transcript is sent to existing validated AI structuredCall()
// -> backend maps AI blocks into participant_summary_output shape.

import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { structuredCall } from "@ai/index";
import type { AIBlock } from "@shared/types";

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

interface TranscriptRow {
  id: string;
  session_id: string;
  speaker: string;
  text: string;
  timestamp: string;
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

async function getTranscripts(sessionId: string): Promise<TranscriptRow[]> {
  const result = await db.query<TranscriptRow>(
    `
    SELECT id, session_id, speaker, text, timestamp
    FROM transcripts
    WHERE session_id = $1
    ORDER BY timestamp ASC
    `,
    [sessionId]
  );
  return result.rows;
}

function minutesBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;

  return Math.max(0, Math.round((endMs - startMs) / 60_000));
}

function uniqueParticipants(rows: TranscriptRow[]): string[] {
  const names = new Set<string>();

  for (const row of rows) {
    const clean = row.speaker?.trim();
    if (clean) names.add(clean);
  }

  return [...names];
}

function transcriptToPrompt(
  session: SessionSummaryRow,
  rows: TranscriptRow[],
): string {
  const transcript = rows
    .map((row) => {
      return `[${row.timestamp}] ${row.speaker}: ${row.text}`;
    })
    .join("\n");

  return `
Create a concise post-meeting summary for this Stratis meeting.

Meeting title:
${session.meeting_title}

Instructions:
- Use the transcript only.
- The transcript may contain conversational Thai and English. Smoothly parse, translate, and synthesize the context across both languages.
- Produce useful participant-facing summary content.
- Organize custom output blocks prioritizing dynamic block structures for: Decisions, Action Items, Open Questions, and Risks.
- Include overview, assumptions, and next steps when present.
- Keep it concise and clear.
- Return valid Stratis AI structured blocks only.

Transcript:
${transcript}
`.trim();
}

function blockTypeFromAI(block: AIBlock): SummaryBlock["block_type"] {
  if (block.type === "DecisionNode") return "DECISIONS";
  if (block.type === "QuestionSuggestion") return "OPEN_ITEMS";
  if (block.type === "SummaryBlock") return "OVERVIEW";
  return "OVERVIEW";
}

function aiBlocksToSummaryBlocks(blocks: AIBlock[]): SummaryBlock[] {
  return blocks.map((block) => ({
    block_type: blockTypeFromAI(block),
    title: block.title,
    content: block.content,
    visible_to_participants: block.type !== "QuestionSuggestion",
  }));
}

function fallbackSummaryBlock(rows: TranscriptRow[]): SummaryBlock {
  const text = rows.map((row) => `${row.speaker}: ${row.text}`).join("\n");

  return {
    block_type: "OVERVIEW",
    title: "Meeting summary",
    content: text.slice(0, 1500) || "No transcript content was available.",
    visible_to_participants: true,
  };
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

    const transcripts = await getTranscripts(sessionId);

    if (transcripts.length === 0) {
      return res.status(409).json({
        ok: false,
        error: "No transcript rows found for this session",
      });
    }

    const participants = uniqueParticipants(transcripts);
    const durationMinutes = minutesBetween(session.started_at, session.ended_at);

    const prompt = transcriptToPrompt(session, transcripts);
    const aiResult = await structuredCall(prompt);

    if (!aiResult.ok) {
      return res.status(422).json({
        ok: false,
        error: `Summary AI output failed validation: ${aiResult.error}`,
        data: {
          provider: aiResult.provider,
          rawText: aiResult.rawText,
        },
      });
    }

    const summaryBlocks =
      aiResult.data.blocks.length > 0
        ? aiBlocksToSummaryBlocks(aiResult.data.blocks)
        : [fallbackSummaryBlock(transcripts)];

    const summary: ParticipantSummaryOutput = {
      output_type: "participant_summary_output",
      session_id: session.id,
      summary_title: `Summary: ${session.meeting_title}`,
      summary_subtitle: `${durationMinutes} min · ${participants.length} participant${
        participants.length === 1 ? "" : "s"
      }`,
      participants,
      duration_minutes: durationMinutes,
      summary_blocks: summaryBlocks,
      action_items: [],
    };

    res.json({
      ok: true,
      data: {
        summary,
        provider: aiResult.provider,
        transcriptCount: transcripts.length,
      },
    });
  } catch (err) {
    next(err);
  }
});