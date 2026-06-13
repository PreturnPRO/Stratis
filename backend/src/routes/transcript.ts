// /api/transcript — S1-T04-C
//
// Routes transcribed text into AI pipeline.
// STT is S1-T04-A.
// Saving transcript rows is S1-T04-D.

import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { structuredCall } from "@ai/index";
import { transcribeAudio } from "../lib/stt";
import * as suggestions from "../realtime/suggestions";
import { detectAnswered } from "../realtime/autodetect";
import { pushSuggestion, pushAnswered } from "../realtime/hub";

export const transcriptRouter = Router();

interface SessionRow {
  id: string;
  facilitator_id: string;
  status: "created" | "active" | "ended";
}

function getSession(sessionId: string): SessionRow | undefined {
  return db
    .prepare(`SELECT id, facilitator_id, status FROM sessions WHERE id = ?`)
    .get<SessionRow>(sessionId);
}

function canUseSession(session: SessionRow, userId: string, role: string): boolean {
  if (role === "admin") return true;
  return session.facilitator_id === userId;
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

  const cards =
    role === "facilitator"
      ? suggestions.createFromBlocks(sessionId, result.data.blocks)
      : [];

  for (const card of cards) {
    pushSuggestion(card);
  }

  return {
    ok: true as const,
    data: {
      sessionId,
      transcript: {
        text,
      },
      ai: {
        provider: result.provider,
        blocks: result.data.blocks,
      },
      suggestions: {
        created: cards,
        answered,
      },
    },
  };
}

transcriptRouter.get("/", requireAuth, (_req, res) => {
  res.json({
    ok: true,
    data: {
      namespace: "transcript",
      status: "ready",
      routes: [
        "POST /api/transcript/chunk",
        "POST /api/transcript/audio-chunk",
      ],
    },
  });
});

/**
 * POST /api/transcript/chunk
 *
 * Body:
 * {
 *   "sessionId": "ses_...",
 *   "text": "transcribed speech..."
 * }
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

    if (!sessionId || !text) {
      return res.status(400).json({
        ok: false,
        error: "body.sessionId and body.text are required",
      });
    }

    const session = getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    if (session.status === "ended") {
      return res.status(409).json({
        ok: false,
        error: "Cannot send transcript to an ended session",
      });
    }

    if (!canUseSession(session, req.auth!.sub, req.auth!.role)) {
      return res.status(403).json({
        ok: false,
        error: "You do not have access to this session",
      });
    }

    const routed = await routeTextToAi(sessionId, text, req.auth!.role);

    if (!routed.ok) {
      return res.status(routed.status).json({
        ok: false,
        error: routed.error,
        data: routed.data,
      });
    }

    res.json({
      ok: true,
      data: routed.data,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/transcript/audio-chunk
 *
 * Body:
 * {
 *   "sessionId": "ses_...",
 *   "audioBase64": "...",
 *   "mimeType": "audio/webm"
 * }
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

    if (!sessionId || !audioBase64) {
      return res.status(400).json({
        ok: false,
        error: "body.sessionId and body.audioBase64 are required",
      });
    }

    const session = getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    if (session.status === "ended") {
      return res.status(409).json({
        ok: false,
        error: "Cannot send audio to an ended session",
      });
    }

    if (!canUseSession(session, req.auth!.sub, req.auth!.role)) {
      return res.status(403).json({
        ok: false,
        error: "You do not have access to this session",
      });
    }

    const cleanBase64 = audioBase64.includes(",")
      ? audioBase64.split(",").pop() ?? ""
      : audioBase64;

    const audio = Buffer.from(cleanBase64, "base64");

    if (audio.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "audioBase64 decoded to empty audio",
      });
    }

    const stt = await transcribeAudio({
      audio,
      mimeType,
    });

    const text = stt.text.trim();

    if (!text) {
      return res.json({
        ok: true,
        data: {
          sessionId,
          transcript: {
            provider: stt.provider,
            text: "",
          },
          ai: null,
          suggestions: {
            created: [],
            answered: [],
          },
        },
      });
    }

    const routed = await routeTextToAi(sessionId, text, req.auth!.role);

    if (!routed.ok) {
      return res.status(routed.status).json({
        ok: false,
        error: routed.error,
        data: routed.data,
      });
    }

    res.json({
      ok: true,
      data: {
        ...routed.data,
        transcript: {
          provider: stt.provider,
          text,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});