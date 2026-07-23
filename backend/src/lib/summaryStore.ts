// Summary store (alignment checkpoint, honest summary). Generates the
// post-meeting summary ONCE and persists it to participant_summaries +
// summary_blocks — the summary a team ratified must not silently change on
// every page view, and re-running the AI per GET was slow and unstored.
//
// Generation is idempotent: a stored summary short-circuits, so the session-end
// hook and the GET route's lazy backfill can both call it safely.
import { db } from "../db/database";
import { newId, now } from "./ids";
import { structuredCall } from "@ai/index";
import type { AIBlock } from "@shared/types";

export interface StoredSummaryBlock {
  block_type: string;
  title: string;
  content: string;
  visible_to_participants: boolean;
}

export interface StoredSummary {
  id: string;
  sessionId: string;
  summaryTitle: string;
  summarySubtitle: string;
  participants: string[];
  durationMinutes: number;
  blocks: StoredSummaryBlock[];
  // Live provider name right after generation; null when read back from the DB
  // (the stored record is provider-agnostic).
  provider: string | null;
  createdAt: string;
}

interface SessionMetaRow {
  meeting_title: string;
  started_at: string | null;
  ended_at: string | null;
}

interface TranscriptRow {
  speaker: string;
  text: string;
  timestamp: string;
}

async function getSessionMeta(sessionId: string): Promise<SessionMetaRow | null> {
  const result = await db.query<SessionMetaRow>(
    `
    SELECT m.title AS meeting_title, s.started_at, s.ended_at
    FROM sessions s
    JOIN meetings m ON m.id = s.meeting_id
    WHERE s.id = $1
    `,
    [sessionId],
  );
  return result.rows[0] ?? null;
}

async function getTranscripts(sessionId: string): Promise<TranscriptRow[]> {
  const result = await db.query<TranscriptRow>(
    `SELECT speaker, text, timestamp FROM transcripts WHERE session_id = $1 ORDER BY timestamp ASC`,
    [sessionId],
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

function transcriptToPrompt(meetingTitle: string, rows: TranscriptRow[]): string {
  const transcript = rows
    .map((row) => `[${row.timestamp}] ${row.speaker}: ${row.text}`)
    .join("\n");

  return `
Create a concise post-meeting summary for this Stratis meeting.

Meeting title:
${meetingTitle}

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

function blockTypeFromAI(block: AIBlock): string {
  if (block.type === "DecisionNode") return "DECISIONS";
  if (block.type === "QuestionSuggestion") return "OPEN_ITEMS";
  return "OVERVIEW";
}

function aiBlocksToSummaryBlocks(blocks: AIBlock[]): StoredSummaryBlock[] {
  return blocks.map((block) => ({
    block_type: blockTypeFromAI(block),
    title: block.title,
    content: block.content,
    visible_to_participants: block.type !== "QuestionSuggestion",
  }));
}

function fallbackSummaryBlock(rows: TranscriptRow[]): StoredSummaryBlock {
  const text = rows.map((row) => `${row.speaker}: ${row.text}`).join("\n");
  return {
    block_type: "OVERVIEW",
    title: "Meeting summary",
    content: text.slice(0, 1500) || "No transcript content was available.",
    visible_to_participants: true,
  };
}

/** The stored summary for a session, or null if none has been generated. */
export async function getStoredSummary(sessionId: string): Promise<StoredSummary | null> {
  const summaryResult = await db.query<{
    id: string;
    session_id: string;
    summary_title: string;
    summary_subtitle: string;
    participants_json: unknown;
    duration_minutes: number;
    created_at: string;
  }>(
    `SELECT id, session_id, summary_title, summary_subtitle, participants_json, duration_minutes, created_at
     FROM participant_summaries WHERE session_id = $1
     ORDER BY created_at ASC LIMIT 1`,
    [sessionId],
  );
  const row = summaryResult.rows[0];
  if (!row) return null;

  const blocksResult = await db.query<StoredSummaryBlock>(
    `SELECT block_type, title, content, visible_to_participants
     FROM summary_blocks WHERE summary_id = $1 ORDER BY sort_order ASC`,
    [row.id],
  );

  // participants_json is JSONB — pg returns it already parsed; tolerate a
  // string in case of a driver/config difference.
  const participants = Array.isArray(row.participants_json)
    ? (row.participants_json as string[])
    : JSON.parse(String(row.participants_json ?? "[]"));

  return {
    id: row.id,
    sessionId: row.session_id,
    summaryTitle: row.summary_title,
    summarySubtitle: row.summary_subtitle,
    participants,
    durationMinutes: row.duration_minutes,
    blocks: blocksResult.rows,
    provider: null,
    createdAt: row.created_at,
  };
}

/**
 * Generate the summary once and persist it. Idempotent — an existing stored
 * summary is returned untouched. Returns null when the session doesn't exist
 * or has no transcript (nothing worth storing). An AI validation failure does
 * NOT abort: the raw-transcript fallback block is stored instead, because a
 * summary the team can read beats a permanently empty page.
 */
export async function generateAndSaveSummary(sessionId: string): Promise<StoredSummary | null> {
  const existing = await getStoredSummary(sessionId);
  if (existing) return existing;

  const meta = await getSessionMeta(sessionId);
  if (!meta) return null;

  const transcripts = await getTranscripts(sessionId);
  if (transcripts.length === 0) return null;

  const aiResult = await structuredCall(transcriptToPrompt(meta.meeting_title, transcripts));
  const blocks =
    aiResult.ok && aiResult.data.blocks.length > 0
      ? aiBlocksToSummaryBlocks(aiResult.data.blocks)
      : [fallbackSummaryBlock(transcripts)];

  const id = newId("sum");
  const ts = now();
  const participants = uniqueParticipants(transcripts);
  const durationMinutes = minutesBetween(meta.started_at, meta.ended_at);

  // The session-end hook and this function's lazy-GET caller can race; the
  // unique index on session_id makes the loser's insert a silent no-op, and
  // blocks are only written by the winner.
  const inserted = await db.query(
    `INSERT INTO participant_summaries
       (id, session_id, summary_title, summary_subtitle, participants_json, duration_minutes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (session_id) DO NOTHING`,
    [
      id,
      sessionId,
      `Summary: ${meta.meeting_title}`,
      `${durationMinutes} min · ${participants.length} participant${participants.length === 1 ? "" : "s"}`,
      JSON.stringify(participants),
      durationMinutes,
      ts,
    ],
  );

  if (inserted.rowCount === 1) {
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      await db.query(
        `INSERT INTO summary_blocks (id, summary_id, block_type, title, content, visible_to_participants, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newId("blk"), id, b.block_type, b.title, b.content, b.visible_to_participants, i],
      );
    }
  }

  const stored = await getStoredSummary(sessionId);
  return stored
    ? { ...stored, provider: aiResult.ok ? aiResult.provider : "fallback" }
    : null;
}
