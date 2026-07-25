import { db } from "../db/database";
import { newId, now } from "./ids";
import { normalizeText } from "./textSimilarity";
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

export async function getDecisions(sessionId: string): Promise<DecisionRecord[]> {
  const result = await db.query<DecisionRow>(
    `SELECT * FROM decisions WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId],
  );
  return result.rows.map(rowToRecord);
}

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

export async function extractAndSaveDecisions(sessionId: string): Promise<DecisionRecord[]> {
  const ctx = await buildExtractContext(sessionId);
  if (!ctx || !ctx.transcript.trim()) return [];

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
  await db.query(`DELETE FROM decisions WHERE session_id = $1 AND source = 'ai'`, [sessionId]);

  const confirmedTexts = facilitatorRows.map((r) => normalizeText(r.text));
  const isConfirmedDuplicate = (text: string): boolean => {
    const norm = normalizeText(text);
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

export interface DecisionPatch {
  dueDate?: string | null;
  owner?: string | null;
  status?: DecisionStatus;
  revisit?: string | null;
  text?: string | null;
  dismissed?: boolean;
}

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
  committed: number;
  withDueDate: number;
  open: number;
  total: number;
  completenessRate: number | null;
}

export function completenessFromRecords(records: DecisionRecord[]): CompletenessMetric {
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
