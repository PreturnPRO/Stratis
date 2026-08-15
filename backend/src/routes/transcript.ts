import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { liveCardCall, type LiveContext } from "@ai/index";
import { transcribeAudio } from "../lib/stt";
import * as suggestions from "../realtime/suggestions";
import { detectAnswered } from "../realtime/autodetect";
import { pushSuggestion, pushAnswered, pushNotes, registerStreamIngest } from "../realtime/hub";
import { getDocumentRow, rowToDocument, renderDocument } from "../lib/pmDocument";
import { withRetry } from "../lib/withRetry";
import { dedupeMemory, shouldReplaceMemory } from "../lib/rollingMemory";
import { cleanSttText, isSttEcho, isSttNoise } from "../lib/sttText";
import { env } from "../config/env";

export const transcriptRouter = Router();

const MIN_AUDIO_CHUNK_BYTES = 2048;
interface SessionRow {
  id: string;
  facilitator_id: string;
  status: "created" | "active" | "ended";
  org_id: string;
}

export interface TranscriptRow {
  id: string;
  session_id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

async function getSession(sessionId: string): Promise<SessionRow | undefined> {
  const result = await db.query<SessionRow>(
    `SELECT s.id, s.facilitator_id, s.status, m.org_id
     FROM sessions s
     JOIN meetings m ON m.id = s.meeting_id
     WHERE s.id = $1`,
    [sessionId]
  );
  return result.rows[0];
}

/**
 * The org check is the load-bearing half. "admin" is a role inside one
 * workspace, not across the product, and signup lets an account choose it — so
 * without `session.org_id === orgId` any stranger could register as an admin
 * and read, or write, the transcript of every meeting in the database. The
 * summary route has always scoped this way; this one had not.
 */
function canUseSession(
  session: SessionRow,
  userId: string,
  _role: string,
  orgId: string,
): boolean {
  if (session.org_id !== orgId) return false;
  // No admin bypass. A workspace admin administers the workspace — accounts,
  // plan, settings — and that is not the same thing as being entitled to read
  // what was said in someone else's meeting.
  return session.facilitator_id === userId;
}

async function saveTranscriptChunk(input: {
  sessionId: string;
  speaker: string;
  text: string;
  timestamp?: string;
}): Promise<TranscriptRow> {
  const id = newId("tx");
  const timestamp = input.timestamp ?? now();

  await db.query(
    `
    INSERT INTO transcripts (id, session_id, speaker, text, timestamp)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [id, input.sessionId, input.speaker, input.text, timestamp]
  );

  return {
    id,
    session_id: input.sessionId,
    speaker: input.speaker,
    text: input.text,
    timestamp,
  };
}

const RECENT_WINDOW_ROWS = 24;

/**
 * Ceilings on what one live suggestion call may carry.
 *
 * A live call fires as often as every 15 seconds — roughly 180 times in a
 * 45-minute meeting — and each one re-sent the entire project document. That
 * document grows for the life of the project, so the cost of a meeting was
 * rising with the age of the project rather than the length of the meeting:
 * one workspace here is already 7.4k characters at version 17.
 *
 * The live pass does not need the whole record. It needs enough to recognise
 * what has already been settled, which is the opening of it. The summary and
 * decision-extraction passes still receive everything — they run once per
 * meeting, where the full document is worth paying for.
 */
const LIVE_DOC_CHARS = 1_500;
const LIVE_RECENT_CHARS = 3_000;
const LIVE_MAX_OPEN_QUESTIONS = 8;

/** Below this a chunk is filler — "ครับ", "ok", a cough — and buys nothing. */
const MIN_CHUNK_CHARS_FOR_AI = 25;

function capText(value: string | null, max: number): string | null {
  if (!value) return value;
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastBreak = cut.lastIndexOf("\n");
  return `${lastBreak > max * 0.6 ? cut.slice(0, lastBreak) : cut}\n…`;
}

const projectDocCache = new Map<string, string | null>();

async function getProjectDocumentForSession(
  sessionId: string,
  orgId: string,
  projectId: string,
): Promise<string | null> {
  if (projectDocCache.has(sessionId)) return projectDocCache.get(sessionId)!;

  const row = await getDocumentRow(orgId, projectId);
  const text = row ? renderDocument(rowToDocument(row).state) : null;
  projectDocCache.set(sessionId, text);
  return text;
}

export function clearProjectDocCache(sessionId: string): void {
  projectDocCache.delete(sessionId);
  const running = aiRoutingBySession.get(sessionId);
  if (running) running.queued = null;
}

async function buildLiveContext(sessionId: string, latestText: string): Promise<LiveContext> {
  const metaResult = await db.query<{
    rolling_summary: string | null;
    goal: string | null;
    brief: string | null;
    project_id: string;
    org_id: string;
  }>(
    `
    SELECT s.rolling_summary AS rolling_summary, m.goal AS goal, m.brief AS brief,
           m.project_id AS project_id, m.org_id AS org_id
    FROM sessions s
    JOIN meetings m ON m.id = s.meeting_id
    WHERE s.id = $1
    `,
    [sessionId]
  );
  const meta = metaResult.rows[0];

  const projectDocument = meta
    ? await getProjectDocumentForSession(sessionId, meta.org_id, meta.project_id)
    : null;

  const recentRowsResult = await db.query<{ speaker: string; text: string }>(
    `
    SELECT speaker, text
    FROM transcripts
    WHERE session_id = $1
    ORDER BY timestamp DESC
    LIMIT $2
    `,
    [sessionId, RECENT_WINDOW_ROWS]
  );
  
  const recentRows = recentRowsResult.rows.reverse();

  const recentTranscript = recentRows.length
    ? recentRows.map((r) => `${r.speaker}: ${r.text}`).join("\n")
    : latestText;

  return {
    sessionId,
    goal: meta?.goal ?? null,
    brief: meta?.brief ?? null,
    rollingSummary: meta?.rolling_summary ?? null,
    // Open cards only. Answered and dismissed ones were still being sent on
    // every call for the rest of the meeting — paying to tell the model about
    // questions it had already closed.
    surfacedQuestions: suggestions
      .openCards(sessionId)
      .slice(-LIVE_MAX_OPEN_QUESTIONS)
      .map((c) => c.question),
    recentTranscript: capText(recentTranscript, LIVE_RECENT_CHARS) ?? recentTranscript,
    projectDocument: capText(projectDocument, LIVE_DOC_CHARS),
  };
}

/**
 * Strike through any open card this text answers. Pure string matching against
 * the cards already on screen — no model call, so it is worth running on every
 * chunk however short.
 */
async function markAnswersFromText(sessionId: string, text: string): Promise<string[]> {
  await suggestions.hydrate(sessionId);

  const open = suggestions.openCards(sessionId);
  const answered: string[] = [];

  for (const id of detectAnswered(text, open)) {
    if (suggestions.markAnswered(sessionId, id, "auto")) {
      pushAnswered(sessionId, id, "auto");
      answered.push(id);
    }
  }

  return answered;
}

async function routeTextToAi(
  sessionId: string,
  text: string,
  role: string,
  transcriptId?: string,
) {
  const answered = await markAnswersFromText(sessionId, text);

  const ctx = await buildLiveContext(sessionId, text);
  const result = await liveCardCall(ctx);

  if (!result.ok) {
    return {
      ok: false as const,
      status: 422,
      error: `AI output failed validation: ${result.error}`,
      data: {
        provider: result.provider,
        rawText: result.rawText,
        answered,
      },
    };
  }

  const out = result.data;

  if (transcriptId) {
    await db.query(
      `UPDATE transcripts SET chunk_signal = $1 WHERE id = $2`, 
      [out.chunk_signal, transcriptId]
    );
  }

  if (out.chunk_signal === "IMPORTANT" && out.rolling_memory_update?.trim()) {
    // The model is asked to merge and keep it tight; this enforces it. Without
    // the cap the memory grows a near-copy of each point, and every later
    // prompt — live cards, decision extract, document patch — pays for it.
    const notes = dedupeMemory(out.rolling_memory_update.trim());
    const previous = ctx.rollingSummary;

    if (shouldReplaceMemory(previous, notes)) {
      await db.query(
        `UPDATE sessions SET rolling_summary = $1 WHERE id = $2`,
        [notes, sessionId]
      );
      pushNotes(sessionId, notes);
    }
  }

  const cards =
    role === "facilitator" ? suggestions.createFromLiveCards(sessionId, out.cards) : [];

  for (const card of cards) pushSuggestion(card);

  return {
    ok: true as const,
    data: {
      ai: {
        provider: result.provider,
        chunkSignal: out.chunk_signal,
        rollingMemoryUpdate: out.rolling_memory_update,
        cards: out.cards,
      },
      suggestions: {
        created: cards,
        answered,
      },
    },
  };
}

interface PendingAiChunk {
  text: string;
  role: string;
  transcriptId?: string;
}

interface AiRoutingState {
  queued: PendingAiChunk | null;
  lastStartedAt: number;
}

const aiRoutingBySession = new Map<string, AiRoutingState>();

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function scheduleAiRouting(
  sessionId: string,
  text: string,
  role: string,
  transcriptId?: string,
): void {
  // Filler costs the same as substance. "ครับ", "okay", "ใช่ ๆ" and a cough
  // each bought a full model call carrying the goal, the rolling summary, the
  // open questions and a slice of the document — and could never produce a
  // suggestion worth showing. The 15-second gate limited how often that
  // happened; it did not stop it.
  //
  // But a short line is exactly how a question gets answered — "ใช่ ตกลง",
  // "Owen รับไป" — and that detection is local string matching, not a model
  // call. It runs either way; only the paid half is skipped.
  if (text.trim().length < MIN_CHUNK_CHARS_FOR_AI) {
    void markAnswersFromText(sessionId, text);
    return;
  }

  const running = aiRoutingBySession.get(sessionId);
  if (running) {
    running.queued = { text, role, transcriptId };
    return;
  }

  const state: AiRoutingState = { queued: null, lastStartedAt: 0 };
  aiRoutingBySession.set(sessionId, state);

  void (async () => {
    let next: PendingAiChunk | null = { text, role, transcriptId };
    while (next) {
      const wait = state.lastStartedAt
        ? env.ai.minCallIntervalMs - (Date.now() - state.lastStartedAt)
        : 0;
      if (wait > 0) {
        await sleep(wait);
        if (state.queued) {
          next = state.queued;
          state.queued = null;
        }
      }

      state.lastStartedAt = Date.now();
      try {
        const routed = await routeTextToAi(sessionId, next.text, next.role, next.transcriptId);
        if (!routed.ok) {
          console.warn(`[transcript:ai] Live AI rejected chunk for ${sessionId}: ${routed.error}`);
        }
      } catch (err) {
        console.error(`[transcript:ai] Live AI routing failed for ${sessionId}:`, err);
      }
      next = state.queued;
      state.queued = null;
    }
    aiRoutingBySession.delete(sessionId);
  })();
}

/**
 * A turn that was typed rather than spoken.
 *
 * The facilitator answering a live card in the text box is answering the room;
 * the AI has to see it or it re-raises the same question thirty seconds later,
 * and the summary would report a question nobody ever settled. It goes through
 * the same save-and-route path a spoken line does — the record does not care
 * which device the words came from.
 */
export async function recordTypedTurn(input: {
  sessionId: string;
  speaker: string;
  text: string;
  role: string;
}): Promise<TranscriptRow> {
  const row = await saveTranscriptChunk({
    sessionId: input.sessionId,
    speaker: input.speaker,
    text: input.text,
  });
  scheduleAiRouting(input.sessionId, input.text, input.role, row.id);
  return row;
}

async function lastTranscriptText(sessionId: string): Promise<string | null> {
  const result = await db.query<{ text: string }>(
    `SELECT text FROM transcripts WHERE session_id = $1 ORDER BY timestamp DESC LIMIT 1`,
    [sessionId],
  );
  return result.rows[0]?.text ?? null;
}

const ingestDeadLetter = new Map<string, Array<{ speaker: string; text: string }>>();
const INGEST_RETRY = { retries: 3, baseMs: 300 } as const;

async function flushIngestDeadLetter(sessionId: string, role: string): Promise<void> {
  const buffered = ingestDeadLetter.get(sessionId);
  if (!buffered || buffered.length === 0) return;
  ingestDeadLetter.delete(sessionId);

  const stillFailing: Array<{ speaker: string; text: string }> = [];
  for (const item of buffered) {
    try {
      const row = await withRetry(
        () => saveTranscriptChunk({ sessionId, speaker: item.speaker, text: item.text }),
        INGEST_RETRY,
      );
      scheduleAiRouting(sessionId, item.text, role, row.id);
    } catch {
      stillFailing.push(item);
    }
  }
  if (stillFailing.length) {
    const current = ingestDeadLetter.get(sessionId) ?? [];
    ingestDeadLetter.set(sessionId, [...stillFailing, ...current]);
  }
}

registerStreamIngest(async ({ sessionId, speaker, text, role }) => {
  const clean = cleanSttText(text);
  if (!clean) return null;

  if (isSttNoise(clean)) {
    console.warn(`[stt:ingest] Dropped a final with no content (session ${sessionId})`);
    return null;
  }

  const session = await getSession(sessionId);
  if (!session || session.status === "ended") return null;

  // Two sockets on one session — a second tab, or a reconnect whose old socket
  // has not been reaped yet — each run their own recogniser over the same room
  // audio and write the same sentence twice. Dropping a final that repeats the
  // line before it costs nothing real: a room that genuinely says the same
  // sentence twice in a row is saying it about the same thing.
  if (isSttEcho(await lastTranscriptText(sessionId), clean)) {
    console.warn(`[stt:ingest] Dropped an echo of the previous line (session ${sessionId})`);
    return null;
  }

  await flushIngestDeadLetter(sessionId, role);

  let row: TranscriptRow;
  try {
    row = await withRetry(
      () => saveTranscriptChunk({ sessionId, speaker, text: clean }),
      INGEST_RETRY,
    );
  } catch (err) {
    const buffer = ingestDeadLetter.get(sessionId) ?? [];
    buffer.push({ speaker, text: clean });
    ingestDeadLetter.set(sessionId, buffer);
    console.error(
      `[stt:ingest] Save failed after retries for session ${sessionId}; ` +
        `buffered (${buffer.length} pending):`,
      err,
    );
    return null;
  }

  scheduleAiRouting(sessionId, clean, role, row.id);
  return row;
});

async function validateSession(req: any, res: any, sessionId: string) {
  const session = await getSession(sessionId);

  if (!session) {
    res.status(404).json({ ok: false, error: "Session not found" });
    return null;
  }

  if (session.status === "ended") {
    res
      .status(409)
      .json({ ok: false, error: "Cannot add transcript to an ended session" });
    return null;
  }

  if (!canUseSession(session, req.auth!.sub, req.auth!.role, req.auth!.orgId)) {
    res
      .status(403)
      .json({ ok: false, error: "You do not have access to this session" });
    return null;
  }

  return session;
}

transcriptRouter.get("/", requireAuth, (_req, res) => {
  res.json({
    ok: true,
    data: {
      namespace: "transcript",
      status: "ready",
      routes: [
        "GET /api/transcript/session/:sessionId",
        "POST /api/transcript/chunk",
        "POST /api/transcript/audio-chunk",
      ],
    },
  });
});

transcriptRouter.get("/session/:sessionId", requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    if (!canUseSession(session, req.auth!.sub, req.auth!.role, req.auth!.orgId)) {
      return res
        .status(403)
        .json({ ok: false, error: "You do not have access to this session" });
    }

    const rowsResult = await db.query<TranscriptRow>(
      `
      SELECT id, session_id, speaker, text, timestamp
      FROM transcripts
      WHERE session_id = $1
      ORDER BY timestamp ASC
      `,
      [sessionId]
    );

    res.json({
      ok: true,
      data: {
        sessionId,
        transcripts: rowsResult.rows,
      },
    });
  } catch (error) {
    console.error("Transcript fetch error:", error);
    res.status(500).json({ ok: false, error: "Internal server error retrieving transcript" });
  }
});

transcriptRouter.post("/chunk", requireAuth, async (req, res, next) => {
  try {
    const sessionId =
      typeof req.body?.sessionId === "string"
        ? req.body.sessionId
        : typeof req.body?.session_id === "string"
          ? req.body.session_id
          : "";

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const speaker =
      typeof req.body?.speaker === "string" && req.body.speaker.trim()
        ? req.body.speaker.trim()
        : "Unknown";

    if (!sessionId || !text) {
      return res.status(400).json({
        ok: false,
        error: "body.sessionId and body.text are required",
      });
    }

    const session = await validateSession(req, res, sessionId);
    if (!session) return;

    let row: TranscriptRow;
    
    try {
      row = await saveTranscriptChunk({
        sessionId,
        speaker,
        text,
        timestamp:
          typeof req.body?.timestamp === "string"
            ? req.body.timestamp
            : undefined,
      });
    } catch (dbError) {
      console.error("[transcript:chunk] Database insert failed, aborting AI call:", dbError);
      return res.status(500).json({
        ok: false,
        error: "Database error saving transcript chunk",
      });
    }

    scheduleAiRouting(sessionId, text, req.auth!.role, row.id);

    res.json({
      ok: true,
      data: {
        sessionId,
        transcript: row,
        ai: { queued: true },
        suggestions: { created: [], answered: [] },
      },
    });
  } catch (err) {
    next(err);
  }
});

transcriptRouter.post("/audio-chunk", requireAuth, async (req, res, next) => {
  try {
    const sessionId =
      typeof req.body?.sessionId === "string"
        ? req.body.sessionId
        : typeof req.body?.session_id === "string"
          ? req.body.session_id
          : "";

    const audioBase64 =
      typeof req.body?.audioBase64 === "string" ? req.body.audioBase64 : "";

    const mimeType =
      typeof req.body?.mimeType === "string" ? req.body.mimeType : "audio/webm";

    const speaker =
      typeof req.body?.speaker === "string" && req.body.speaker.trim()
        ? req.body.speaker.trim()
        : "Speaker";

    if (!sessionId || !audioBase64) {
      return res.status(400).json({
        ok: false,
        error: "body.sessionId and body.audioBase64 are required",
      });
    }

    const session = await validateSession(req, res, sessionId);
    if (!session) return;

    const cleanBase64 = audioBase64.includes(",")
      ? (audioBase64.split(",").pop() ?? "")
      : audioBase64;

    const audio = Buffer.from(cleanBase64, "base64");

    console.log("[transcript] audio upload", {
      sessionId,
      bytes: audio.length,
      mimeType,
    });

    if (audio.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "audioBase64 decoded to empty audio",
      });
    }

    if (audio.length < MIN_AUDIO_CHUNK_BYTES) {
      console.warn("[transcript] skipped tiny audio chunk", {
        sessionId,
        bytes: audio.length,
        mimeType,
      });

      return res.json({
        ok: true,
        data: {
          sessionId,
          stt: {
            provider: "skipped",
            text: "",
            raw: {
              skipped: true,
              reason: "tiny_audio_chunk",
              bytes: audio.length,
              mimeType,
            },
          },
          ai: {
            provider: null,
            blocks: [],
          },
          suggestions: {
            created: [],
            answered: [],
          },
        },
      });
    }

    let stt;

    try {
      stt = await transcribeAudio({ audio, mimeType });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Speech-to-text failed";

      return res.status(502).json({
        ok: false,
        error: message,
        data: {
          sessionId,
          transcript: null,
          stt: null,
          ai: null,
          suggestions: {
            created: [],
            answered: [],
          },
        },
      });
    }

    const text = cleanSttText(stt.text);

    if (!text) {
      return res.json({
        ok: true,
        data: {
          sessionId,
          transcript: null,
          ai: null,
          suggestions: { created: [], answered: [] },
        },
      });
    }

    let row: TranscriptRow;

    try {
      row = await saveTranscriptChunk({
        sessionId,
        speaker,
        text,
      });
    } catch (dbError) {
      console.error("[transcript:audio-chunk] Database insert failed, aborting AI call:", dbError);
      return res.status(500).json({
        ok: false,
        error: "Database error saving audio transcript chunk",
      });
    }

    scheduleAiRouting(sessionId, text, req.auth!.role, row.id);

    res.json({
      ok: true,
      data: {
        sessionId,
        transcript: row,
        stt: { provider: stt.provider },
        ai: { queued: true },
        suggestions: { created: [], answered: [] },
      },
    });
  } catch (err) {
    next(err);
  }
});
