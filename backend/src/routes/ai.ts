import { Router } from "express";
import { firstCall, structuredCall } from "@ai/index";
import { requireAuth } from "../auth/middleware";
import { requireSessionAccess } from "../middleware/requireSessionAccess";
import * as suggestions from "../realtime/suggestions";
import { detectAnswered } from "../realtime/autodetect";
import { pushSuggestion, pushAnswered, pushTranscript } from "../realtime/hub";
import { recordTypedTurn } from "./transcript";
import { placeholder } from "./_placeholder";
import { validateAiOutput } from "../middleware/validateAiOutput";
import type { WsTranscriptRow } from "@shared/types";

export const aiRouter = Router();

aiRouter.get(
  "/",
  placeholder(
    "ai",
    "POST/GET /api/ai/test sends a hardcoded prompt (S1-T03-B)",
  ),
);

// requireAuth on both of these: they are Sprint-1 scaffolding that reaches the
// paid LLM. Open to the internet they are a metered bill anyone can run up —
// and a prompt anyone can choose.
aiRouter.get("/test", requireAuth, async (_req, res, next) => {
  try {
    const result = await firstCall();
    res.json({
      ok: true,
      data: { provider: result.provider, text: result.text, raw: result.raw },
    });
  } catch (err) {
    next(err);
  }
});

aiRouter.post("/structure", requireAuth, async (req, res, next) => {
  try {
    const input = typeof req.body?.input === "string" ? req.body.input : "";
    if (input.trim() === "") {
      return res
        .status(400)
        .json({ ok: false, error: "body.input (string) is required" });
    }

    const result = await structuredCall(input);
    if (!result.ok) {
      return res.status(422).json({
        ok: false,
        error: `AI output failed validation: ${result.error}`,
        data: { provider: result.provider, rawText: result.rawText },
      });
    }

    const checked = validateAiOutput(result.data);
    if (!checked.ok) {
      return res.status(422).json({
        ok: false,
        error: `AI output failed validation: ${checked.error}`,
        data: { provider: result.provider },
      });
    }

    res.json({
      ok: true,
      data: { provider: result.provider, ...checked.data },
    });
  } catch (err) {
    next(err);
  }
});

aiRouter.post("/suggest", requireAuth, requireSessionAccess(), async (req, res, next) => {
  try {
    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
    const input = typeof req.body?.input === "string" ? req.body.input : "";
    if (!sessionId || input.trim() === "") {
      return res
        .status(400)
        .json({
          ok: false,
          error: "body.sessionId and body.input (string) are required",
        });
    }
    if (req.auth!.role !== "facilitator") {
      return res
        .status(403)
        .json({
          ok: false,
          error: "Only the facilitator can request suggestions",
        });
    }

    const result = await structuredCall(input);
    if (!result.ok) {
      return res.status(422).json({
        ok: false,
        error: `AI output failed validation: ${result.error}`,
        data: { provider: result.provider, rawText: result.rawText },
      });
    }

    const cards = suggestions.createFromBlocks(sessionId, result.data.blocks);
    for (const card of cards) pushSuggestion(card);

    res.json({ ok: true, data: { provider: result.provider, cards } });
  } catch (err) {
    next(err);
  }
});

aiRouter.post("/suggest/scan", requireAuth, requireSessionAccess(), (req, res) => {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const transcript =
    typeof req.body?.transcript === "string" ? req.body.transcript : "";
  if (!sessionId || transcript.trim() === "") {
    return res
      .status(400)
      .json({
        ok: false,
        error: "body.sessionId and body.transcript (string) are required",
      });
  }

  const open = suggestions.openCards(sessionId);
  const ids = detectAnswered(transcript, open);
  const answered: string[] = [];
  for (const id of ids) {
    if (suggestions.markAnswered(sessionId, id, "auto")) {
      pushAnswered(sessionId, id, "auto");
      answered.push(id);
    }
  }

  res.json({ ok: true, data: { sessionId, answered } });
});

/** Longest typed answer accepted. Past this it is a document, not an answer. */
const MAX_TYPED_ANSWER_CHARS = 1_000;

/**
 * Clear a card — with or without typing the answer.
 *
 * `body.answer` is optional and is the whole point of the text box: the only
 * way to answer the AI co-facilitator used to be to say it out loud, which
 * meant interrupting whoever was speaking to talk to a machine. A typed answer
 * is written into the transcript as a turn by the facilitator, so the live pass
 * stops re-raising the question and the summary can see what settled it.
 */
aiRouter.post("/suggest/answer", requireAuth, requireSessionAccess(), async (req, res, next) => {
  try {
    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
    const cardId = typeof req.body?.cardId === "string" ? req.body.cardId : "";
    const answer =
      typeof req.body?.answer === "string"
        ? req.body.answer.trim().slice(0, MAX_TYPED_ANSWER_CHARS)
        : "";
    const speaker =
      typeof req.body?.speaker === "string" && req.body.speaker.trim()
        ? req.body.speaker.trim().slice(0, 60)
        : "Facilitator";

    if (!sessionId || !cardId) {
      return res
        .status(400)
        .json({
          ok: false,
          error: "body.sessionId and body.cardId are required",
        });
    }
    if (req.auth!.role !== "facilitator") {
      return res
        .status(403)
        .json({
          ok: false,
          error: "Only the facilitator can mark cards answered",
        });
    }

    const card = suggestions.markAnswered(sessionId, cardId, "manual", answer || null);
    if (!card) {
      return res
        .status(404)
        .json({ ok: false, error: "Card not found or already answered" });
    }
    pushAnswered(sessionId, cardId, "manual");

    // After the card is cleared, never before it. A failed transcript write must
    // not leave the facilitator pressing Send at a card that will not go away —
    // the answer is theirs, the transcript row is bookkeeping.
    let transcript: WsTranscriptRow | null = null;
    if (answer) {
      try {
        const row = await recordTypedTurn({
          sessionId,
          speaker,
          text: answer,
          role: req.auth!.role,
        });
        transcript = row;
        pushTranscript(sessionId, row);
      } catch (err) {
        console.error(`[ai:answer] Could not record the typed answer for ${sessionId}:`, err);
      }
    }

    res.json({ ok: true, data: { card, transcript } });
  } catch (err) {
    next(err);
  }
});

aiRouter.post("/suggest/dismiss", requireAuth, requireSessionAccess(), (req, res) => {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const cardId = typeof req.body?.cardId === "string" ? req.body.cardId : "";
  if (!sessionId || !cardId) {
    return res
      .status(400)
      .json({
        ok: false,
        error: "body.sessionId and body.cardId are required",
      });
  }
  if (req.auth!.role !== "facilitator") {
    return res
      .status(403)
      .json({ ok: false, error: "Only the facilitator can dismiss cards" });
  }

  const card = suggestions.dismissCard(sessionId, cardId);
  if (!card) {
    return res.status(404).json({ ok: false, error: "Card not found" });
  }
  res.json({ ok: true, data: { card } });
});

aiRouter.get("/suggest/:sessionId", requireAuth, requireSessionAccess("params"), async (req, res, next) => {
  try {
    await suggestions.hydrate(req.params.sessionId);
    const cards = suggestions.allCards(req.params.sessionId);
    res.json({ ok: true, data: { sessionId: req.params.sessionId, cards } });
  } catch (err) {
    next(err);
  }
});
