import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { liveCardCall, type LiveContext } from "@ai/index";
import { transcribeAudio } from "../lib/stt";
import * as suggestions from "../realtime/suggestions";
import { detectAnswered } from "../realtime/autodetect";
import { pushSuggestion, pushAnswered } from "../realtime/hub";
import { getDocumentRow, rowToDocument, renderDocument } from "../lib/pmDocument";

export const transcriptRouter = Router();

const MIN_AUDIO_CHUNK_BYTES = 2048;
interface SessionRow {
  id: string;
  facilitator_id: string;
  status: "created" | "active" | "ended";
}

interface TranscriptRow {
  id: string;
  session_id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

async function getSession(sessionId: string): Promise<SessionRow | undefined> {
  const result = await db.query<SessionRow>(
    `SELECT id, facilitator_id, status FROM sessions WHERE id = $1`,
    [sessionId]
  );
  return result.rows[0];
}

function canUseSession(
  session: SessionRow,
  userId: string,
  role: string,
): boolean {
  if (role === "admin") return true;
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

  // Crucially awaited. Throws to the caller if the DB constraints fail.
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

// Recent transcript window the live AI sees each chunk (schema spec §6.4 — the
// last 1-3 minutes, not the whole meeting). Capped to the most recent rows.
const RECENT_WINDOW_ROWS = 12;

// A project's PM document can only change via the post-meeting commit flow
// (document.ts), which can't happen mid-session — so it's safe (and avoids a
// DB round-trip per transcript chunk) to fetch it once per session and reuse
// it for every live AI call in that session. Mirrors the bySession cache
// pattern in backend/src/realtime/suggestions.ts.
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

/** Called when a session ends so a stale/absent cache entry can't leak into a
 * future session reusing the same id space, and to bound cache growth. Also
 * drops any queued background AI routing so an ended session can't receive a
 * late suggestion card. */
export function clearProjectDocCache(sessionId: string): void {
  projectDocCache.delete(sessionId);
  const running = aiRoutingBySession.get(sessionId);
  if (running) running.queued = null;
}

/** Build the live AI context for a session: meeting goal/brief, rolling memory,
 * open questions, the project's existing PM document (if this meeting
 * continues a prior project), and the recent transcript window. */
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
    openQuestions: suggestions.openCards(sessionId).map((c) => c.question),
    recentTranscript,
    projectDocument,
  };
}

/**
 * Route a fresh transcript chunk through the live meeting AI (schema spec §6):
 * auto-detect answered cards, call the live_card gateway with rolling context,
 * persist the chunk signal + updated rolling memory, and push new cards.
 */
async function routeTextToAi(
  sessionId: string,
  text: string,
  role: string,
  transcriptId?: string,
) {
  const open = suggestions.openCards(sessionId);
  const answeredIds = detectAnswered(text, open);

  const answered: string[] = [];
  for (const id of answeredIds) {
    if (suggestions.markAnswered(sessionId, id, "auto")) {
      pushAnswered(sessionId, id, "auto");
      answered.push(id);
    }
  }

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

  // Persist the chunk classification on the saved transcript row.
  if (transcriptId) {
    await db.query(
      `UPDATE transcripts SET chunk_signal = $1 WHERE id = $2`, 
      [out.chunk_signal, transcriptId]
    );
  }

  // IMPORTANT chunks update rolling memory (schema spec §6.4); others skipped.
  if (out.chunk_signal === "IMPORTANT" && out.rolling_memory_update?.trim()) {
    await db.query(
      `UPDATE sessions SET rolling_summary = $1 WHERE id = $2`, 
      [out.rolling_memory_update.trim(), sessionId]
    );
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

// Live-AI routing runs OFF the HTTP request path. The client gets its
// transcript row back as soon as STT + the DB insert finish; cards and
// answered-detections still reach the facilitator over the WebSocket hub.
// (Holding the response on the Groq call — which the rate-limit gate can
// stall for tens of seconds under 429 backoff — made the live transcript
// lag minutes behind the meeting.)
// At most one call runs per session with one queued behind it; intermediate
// chunks are skipped. Nothing is lost: each call re-reads the recent
// transcript window from the DB, so skipped chunks still inform the next
// call — they just miss their per-row chunk_signal classification.
interface PendingAiChunk {
  text: string;
  role: string;
  transcriptId?: string;
}

const aiRoutingBySession = new Map<string, { queued: PendingAiChunk | null }>();

function scheduleAiRouting(
  sessionId: string,
  text: string,
  role: string,
  transcriptId?: string,
): void {
  const running = aiRoutingBySession.get(sessionId);
  if (running) {
    running.queued = { text, role, transcriptId };
    return;
  }

  const state: { queued: PendingAiChunk | null } = { queued: null };
  aiRoutingBySession.set(sessionId, state);

  void (async () => {
    let next: PendingAiChunk | null = { text, role, transcriptId };
    while (next) {
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

  if (!canUseSession(session, req.auth!.sub, req.auth!.role)) {
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

/**
 * GET /api/transcript/session/:sessionId
 * Load saved transcript after refresh.
 */
transcriptRouter.get("/session/:sessionId", requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    if (!canUseSession(session, req.auth!.sub, req.auth!.role)) {
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

/**
 * POST /api/transcript/chunk
 */
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
    
    // Strict block: Abort AI integration if the database insert fails
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

/**
 * POST /api/transcript/audio-chunk
 */
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

    const text = stt.text.replace(/([\u0E00-\u0E7F])\s+(?=[\u0E00-\u0E7F])/g, '$1').trim();

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

    // Strict block: Abort AI integration if the database insert fails
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