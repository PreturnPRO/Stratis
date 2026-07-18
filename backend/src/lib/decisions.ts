// Decision store (alignment checkpoint). Persists the decisions the AI extracts
// from a finished session's transcript, and computes the completeness metric.
//
// Extraction runs at wrap-up / session end (off the live path — the whole-meeting
// call is far heavier than a per-chunk live-card call). Re-running replaces the
// AI-authored rows but preserves any the facilitator has since edited, so a late
// re-extract can't clobber human confirmations from the checkpoint.
import { db } from "../db/database";
import { newId, now } from "./ids";
import { extractDecisionsCall } from "@ai/index";
import type { DecisionRecord, DecisionStatus } from "@shared/types";

interface DecisionRow {
  id: string;
  session_id: string;
  meeting_id: string;
  text: string;
  due_date: string | null;
  owner: string | null;
  scope: string | null;
  status: DecisionStatus;
  revisit: string | null;
  missing: string | null;
  confidence: number | null;
  source: "ai" | "facilitator";
  dismissed: boolean;
  created_at: string;
  updated_at: string;
}

// Mirrors normalizeQuestion in realtime/suggestions.ts — same dedup problem,
// same tolerance: whitespace, case, and trailing punctuation don't make two
// decisions different.
function normalizeDecisionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/g, "");
}

function rowToRecord(r: DecisionRow): DecisionRecord {
  return {
    id: r.id,
    sessionId: r.session_id,
    meetingId: r.meeting_id,
    text: r.text,
    dueDate: r.due_date,
    owner: r.owner,
    scope: r.scope,
    status: r.status,
    revisit: r.revisit,
    missing: r.missing,
    confidence: r.confidence,
    source: r.source,
    dismissed: r.dismissed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** All decisions for a session, oldest first (extraction order). */
export async function getDecisions(sessionId: string): Promise<DecisionRecord[]> {
  const result = await db.query<DecisionRow>(
    `SELECT * FROM decisions WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId],
  );
  return result.rows.map(rowToRecord);
}

/** Meeting goal, rolling memory, meeting_id, and the full transcript for a
 *  session — the context the extraction AI needs to pin down decisions. */
async function buildExtractContext(sessionId: string): Promise<{
  meetingId: string;
  goal: string | null;
  rollingSummary: string | null;
  transcript: string;
} | null> {
  const metaResult = await db.query<{
    meeting_id: string;
    goal: string | null;
    rolling_summary: string | null;
  }>(
    `
    SELECT s.meeting_id AS meeting_id, m.goal AS goal, s.rolling_summary AS rolling_summary
    FROM sessions s
    JOIN meetings m ON m.id = s.meeting_id
    WHERE s.id = $1
    `,
    [sessionId],
  );
  const meta = metaResult.rows[0];
  if (!meta) return null;

  const rowsResult = await db.query<{ speaker: string; text: string }>(
    `SELECT speaker, text FROM transcripts WHERE session_id = $1 ORDER BY timestamp ASC`,
    [sessionId],
  );
  const transcript = rowsResult.rows.map((r) => `${r.speaker}: ${r.text}`).join("\n");

  return {
    meetingId: meta.meeting_id,
    goal: meta.goal,
    rollingSummary: meta.rolling_summary,
    transcript,
  };
}

/**
 * Extract decisions from a session's transcript and persist them. Replaces the
 * session's AI-authored rows (a re-run supersedes stale AI output) but leaves
 * facilitator-edited rows untouched. Returns the full current decision set, or
 * an empty array if there was no transcript or the AI call failed (never throws
 * — extraction is best-effort and must not block session end).
 */
export async function extractAndSaveDecisions(sessionId: string): Promise<DecisionRecord[]> {
  const ctx = await buildExtractContext(sessionId);
  if (!ctx || !ctx.transcript.trim()) return [];

  // Facilitator-confirmed rows survive a re-extract; the model is told about
  // them so it doesn't re-list them (belt), and inserts are containment-checked
  // against them below (suspenders — the model rewords nondeterministically).
  const facilitatorRows = (await getDecisions(sessionId)).filter(
    (r) => r.source === "facilitator",
  );

  let extracted;
  try {
    const result = await extractDecisionsCall({
      sessionId,
      goal: ctx.goal,
      transcript: ctx.transcript,
      rollingSummary: ctx.rollingSummary,
      confirmedDecisions: facilitatorRows.map((r) => r.text),
    });
    if (!result.ok) {
      console.warn(`[decisions] extract failed for ${sessionId}: ${result.error}`);
      return getDecisions(sessionId);
    }
    extracted = result.data.decisions;
  } catch (err) {
    console.error(`[decisions] extract threw for ${sessionId}:`, err);
    return getDecisions(sessionId);
  }

  const ts = now();
  // Replace only AI rows; facilitator confirmations survive a re-extract.
  await db.query(`DELETE FROM decisions WHERE session_id = $1 AND source = 'ai'`, [sessionId]);

  // Containment check against confirmed rows: the model rewords decisions
  // nondeterministically ("เปิดตัวเบต้า…" vs "เปิดตัวเบต้า… (สิงหาคม 2026)"),
  // so equality is too weak — either text containing the other counts as the
  // same decision. A full paraphrase can still slip through; the facilitator
  // sees it and can dismiss.
  const confirmedTexts = facilitatorRows.map((r) => normalizeDecisionText(r.text));
  const isConfirmedDuplicate = (text: string): boolean => {
    const norm = normalizeDecisionText(text);
    return confirmedTexts.some((c) => norm.includes(c) || c.includes(norm));
  };

  for (const d of extracted) {
    if (isConfirmedDuplicate(d.text)) continue;
    await db.query(
      `
      INSERT INTO decisions
        (id, session_id, meeting_id, text, due_date, owner, scope, status, revisit, missing, confidence, source, dismissed, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ai', FALSE, $12, $13)
      `,
      [
        newId("dec"),
        sessionId,
        ctx.meetingId,
        d.text,
        d.due_date ?? null,
        d.owner ?? null,
        d.scope ?? null,
        d.status,
        d.revisit ?? null,
        d.missing ?? null,
        d.confidence ?? null,
        ts,
        ts,
      ],
    );
  }

  return getDecisions(sessionId);
}

/** Fields the facilitator can change from the closing checkpoint. */
export interface DecisionPatch {
  dueDate?: string | null;
  owner?: string | null;
  status?: DecisionStatus;
  revisit?: string | null;
  text?: string | null;
  dismissed?: boolean;
}

/** Apply a facilitator edit to one decision and flip its source to
 *  "facilitator" so a later re-extract won't overwrite it. Recomputes "missing"
 *  from the new state. Returns the updated row, or null if it isn't this
 *  session's decision. */
export async function updateDecision(
  sessionId: string,
  decisionId: string,
  patch: DecisionPatch,
): Promise<DecisionRecord | null> {
  const existing = await db.query<DecisionRow>(
    `SELECT * FROM decisions WHERE id = $1 AND session_id = $2`,
    [decisionId, sessionId],
  );
  const row = existing.rows[0];
  if (!row) return null;

  const dueDate = patch.dueDate !== undefined ? patch.dueDate : row.due_date;
  const owner = patch.owner !== undefined ? patch.owner : row.owner;
  const status = patch.status ?? row.status;
  const revisit = patch.revisit !== undefined ? patch.revisit : row.revisit;
  const text = patch.text != null && patch.text.trim() !== "" ? patch.text.trim() : row.text;
  const dismissed = patch.dismissed !== undefined ? patch.dismissed : row.dismissed;
  // A committed decision with a due date is no longer missing anything.
  const missing = status === "incomplete" && !dueDate ? (row.missing ?? "no deadline") : null;

  const updated = await db.query<DecisionRow>(
    `
    UPDATE decisions
    SET text = $1, due_date = $2, owner = $3, status = $4, revisit = $5,
        missing = $6, dismissed = $7, source = 'facilitator', updated_at = $8
    WHERE id = $9 AND session_id = $10
    RETURNING *
    `,
    [text, dueDate, owner, status, revisit, missing, dismissed, now(), decisionId, sessionId],
  );
  return updated.rows[0] ? rowToRecord(updated.rows[0]) : null;
}

export interface CompletenessMetric {
  // Committed decisions = complete + incomplete (excludes deliberately-open).
  committed: number;
  withDueDate: number;
  open: number;
  total: number;
  // % of committed decisions that left with a due date. null when there are no
  // committed decisions (rate would divide by zero — "no decisions" is not 0%).
  completenessRate: number | null;
}

/** The traction metric: of the decisions the room actually committed to, how
 *  many left COMPLETE. Counted by status, not by due_date presence — the model
 *  sometimes infers a soft date ("เดือนหน้า" → an ISO guess) while still
 *  marking the decision incomplete, and the metric must agree with the
 *  incomplete-count the checkpoint headline shows. Deliberately-open items are
 *  excluded — they are a valid outcome, not an incomplete decision. */
export function completenessFromRecords(records: DecisionRecord[]): CompletenessMetric {
  // Dismissed rows are rejected extractions, not meeting outcomes — they count
  // toward nothing.
  const live = records.filter((d) => !d.dismissed);
  const committedRecords = live.filter((d) => d.status !== "open");
  const committed = committedRecords.length;
  const withDueDate = committedRecords.filter((d) => d.status === "complete").length;
  const open = live.filter((d) => d.status === "open").length;
  return {
    committed,
    withDueDate,
    open,
    total: live.length,
    completenessRate: committed === 0 ? null : Math.round((withDueDate / committed) * 100),
  };
}
