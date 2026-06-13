// /api/transcript — S1-T04-A
//
// Speech-to-text integration.
// This route does STT only.
// Saving transcript to DB is S1-T04-D.
// Sending transcript to AI pipeline is S1-T04-C.

import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { transcribeAudio } from "../lib/stt";

export const transcriptRouter = Router();

/**
 * GET /api/transcript
 */
transcriptRouter.get("/", requireAuth, (_req, res) => {
  res.json({
    ok: true,
    data: {
      namespace: "transcript",
      status: "ready",
      note: "POST /api/transcript/transcribe with audioBase64 + mimeType",
    },
  });
});

/**
 * POST /api/transcript/transcribe
 *
 * Body:
 * {
 *   "audioBase64": "...",
 *   "mimeType": "audio/webm"
 * }
 */
transcriptRouter.post("/transcribe", requireAuth, async (req, res, next) => {
  try {
    const audioBase64 =
      typeof req.body?.audioBase64 === "string"
        ? req.body.audioBase64
        : "";

    const mimeType =
      typeof req.body?.mimeType === "string"
        ? req.body.mimeType
        : "audio/webm";

    if (!audioBase64) {
      return res.status(400).json({
        ok: false,
        error: "body.audioBase64 is required",
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

    const result = await transcribeAudio({
      audio,
      mimeType,
    });

    res.json({
      ok: true,
      data: {
        provider: result.provider,
        text: result.text,
      },
    });
  } catch (err) {
    next(err);
  }
});