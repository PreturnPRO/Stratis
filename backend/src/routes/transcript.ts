import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { structuredCall } from "@ai/index";
import { transcribeAudio } from "../lib/stt";
import * as suggestions from "../realtime/suggestions";
import { detectAnswered } from "../realtime/autodetect";
import { pushSuggestion, pushAnswered } from "../realtime/hub";
import { validateAiOutput } from "../middleware/validateAiOutput";

export const transcriptRouter = Router();

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

function getSession(sessionId: string): SessionRow | undefined {
  return db
    .prepare(`SELECT id, facilitator_id, status FROM sessions WHERE id = ?`)
    .get<SessionRow>(sessionId);
}

function canUseSession(
  session: SessionRow,
  userId: string,
  role: string,
): boolean {
  if (role === "admin") return true;
  return session.facilitator_id === userId;
}

function saveTranscriptChunk(input: {
  sessionId: string;
  speaker: string;
  text: string;
  timestamp?: string;
}): TranscriptRow {
  const id = newId("tx");
  const timestamp = input.timestamp ?? now();

  db.prepare(
    `
    INSERT INTO transcripts (id, session_id, speaker, text, timestamp)
    VALUES (?, ?, ?, ?, ?)
    `,
  ).run(id, input.sessionId, input.speaker, input.text, timestamp);

  return {
    id,
    session_id: input.sessionId,
    speaker: input.speaker,
    text: input.text,
    timestamp,
  };
}

async function routeTextToAi(sessionId: string, text: string, role: string) {
  const open = suggestions.openCards(sessionId);
  const answeredIds = detectAnswered(text, open);

  const answered: string[] = [];
  for (const id of answeredIds) {
    if (suggestions.markAnswered(sessionId, id, "auto")) {
      pushAnswered(sessionId, id, "auto");
      answered.push(id);
    }
  }

  const result = await structuredCall(text);

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

  const checked = validateAiOutput(result.data);
  if (!checked.ok) {
    return {
      ok: false as const,
      status: 422,
      error: `AI output failed validation: ${checked.error}`,
      data: {
        provider: result.provider,
        answered,
      },
    };
  }

  const cards =
    role === "facilitator"
      ? suggestions.createFromBlocks(sessionId, checked.data.blocks)
      : [];

  for (const card of cards) pushSuggestion(card);

  return {
    ok: true as const,
    data: {
      ai: {
        provider: result.provider,
        blocks: checked.data.blocks,
      },
      suggestions: {
        created: cards,
        answered,
      },
    },
  };
}

function validateSession(req: any, res: any, sessionId: string) {
  const session = getSession(sessionId);

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
transcriptRouter.get("/session/:sessionId", requireAuth, (req, res) => {
  const sessionId = req.params.sessionId;
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  if (!canUseSession(session, req.auth!.sub, req.auth!.role)) {
    return res
      .status(403)
      .json({ ok: false, error: "You do not have access to this session" });
  }

  const rows = db
    .prepare(
      `
      SELECT id, session_id, speaker, text, timestamp
      FROM transcripts
      WHERE session_id = ?
      ORDER BY timestamp ASC
      `,
    )
    .all<TranscriptRow>(sessionId);

  res.json({
    ok: true,
    data: {
      sessionId,
      transcripts: rows,
    },
  });
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

    if (!validateSession(req, res, sessionId)) return;

    const row = saveTranscriptChunk({
      sessionId,
      speaker,
      text,
      timestamp:
        typeof req.body?.timestamp === "string"
          ? req.body.timestamp
          : undefined,
    });

    const routed = await routeTextToAi(sessionId, text, req.auth!.role);

    if (!routed.ok) {
      return res.status(routed.status).json({
        ok: false,
        error: routed.error,
        data: {
          transcript: row,
          ...routed.data,
        },
      });
    }

    res.json({
      ok: true,
      data: {
        sessionId,
        transcript: row,
        ...routed.data,
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

    if (!validateSession(req, res, sessionId)) return;

    const cleanBase64 = audioBase64.includes(",")
      ? (audioBase64.split(",").pop() ?? "")
      : audioBase64;

    const audio = Buffer.from(cleanBase64, "base64");

    if (audio.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "audioBase64 decoded to empty audio",
      });
    }

    const stt = await transcribeAudio({ audio, mimeType });
    const text = stt.text.trim();

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

    const row = saveTranscriptChunk({
      sessionId,
      speaker,
      text,
    });

    const routed = await routeTextToAi(sessionId, text, req.auth!.role);

    if (!routed.ok) {
      return res.status(routed.status).json({
        ok: false,
        error: routed.error,
        data: {
          transcript: row,
          stt: { provider: stt.provider },
          ...routed.data,
        },
      });
    }

    res.json({
      ok: true,
      data: {
        sessionId,
        transcript: row,
        stt: { provider: stt.provider },
        ...routed.data,
      },
    });
  } catch (err) {
    next(err);
  }
});
