// /api/ai (S1-T03-B). Sends a hardcoded test prompt to the configured AI
// provider, logs the raw response server-side, and returns it.
// Structured-JSON output + validation comes in S1-T03-C / S1-T05.
// Suggestion routing to the facilitator's card stack: S1-T03-E.
import { Router } from "express";
import { firstCall, structuredCall } from "@ai/index";
import { requireAuth } from "../auth/middleware";
import * as suggestions from "../realtime/suggestions";
import { detectAnswered } from "../realtime/autodetect";
import { pushSuggestion, pushAnswered } from "../realtime/hub";
import { placeholder } from "./_placeholder";

export const aiRouter = Router();

// Info ping — confirms the namespace is mounted.
aiRouter.get("/", placeholder("ai", "POST/GET /api/ai/test sends a hardcoded prompt (S1-T03-B)"));

// S1-T03-B: trigger the first AI call.
aiRouter.get("/test", async (_req, res, next) => {
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

// S1-T03-C: send input, get JSON-only output, validate against the schema, and
// return the typed blocks. Invalid model output → 422 with the parse error,
// never an unvalidated payload.
aiRouter.post("/structure", async (req, res, next) => {
  try {
    const input = typeof req.body?.input === "string" ? req.body.input : "";
    if (input.trim() === "") {
      return res.status(400).json({ ok: false, error: "body.input (string) is required" });
    }

    const result = await structuredCall(input);
    if (!result.ok) {
      return res.status(422).json({
        ok: false,
        error: `AI output failed validation: ${result.error}`,
        data: { provider: result.provider, rawText: result.rawText },
      });
    }
    res.json({ ok: true, data: { provider: result.provider, ...result.data } });
  } catch (err) {
    next(err);
  }
});

// S1-T03-E: generate suggestions for a session. Runs the structured call, turns
// any QuestionSuggestion blocks into cards, and pushes each to the facilitator's
// stack over WebSocket (newest on top). Facilitator-only.
aiRouter.post("/suggest", requireAuth, async (req, res, next) => {
  try {
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
    const input = typeof req.body?.input === "string" ? req.body.input : "";
    if (!sessionId || input.trim() === "") {
      return res
        .status(400)
        .json({ ok: false, error: "body.sessionId and body.input (string) are required" });
    }
    if (req.auth!.role !== "facilitator") {
      return res.status(403).json({ ok: false, error: "Only the facilitator can request suggestions" });
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

// S1-T03-E: auto-detect. Feed a transcript chunk; any open card the transcript
// has now raised AND answered is struck through and the event pushed to the
// facilitator. Returns the answered card ids.
aiRouter.post("/suggest/scan", requireAuth, (req, res) => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const transcript = typeof req.body?.transcript === "string" ? req.body.transcript : "";
  if (!sessionId || transcript.trim() === "") {
    return res
      .status(400)
      .json({ ok: false, error: "body.sessionId and body.transcript (string) are required" });
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

// S1-T03-E: manual override. The facilitator taps a card to mark it answered,
// regardless of the transcript.
aiRouter.post("/suggest/answer", requireAuth, (req, res) => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const cardId = typeof req.body?.cardId === "string" ? req.body.cardId : "";
  if (!sessionId || !cardId) {
    return res
      .status(400)
      .json({ ok: false, error: "body.sessionId and body.cardId are required" });
  }
  if (req.auth!.role !== "facilitator") {
    return res.status(403).json({ ok: false, error: "Only the facilitator can mark cards answered" });
  }

  const card = suggestions.markAnswered(sessionId, cardId, "manual");
  if (!card) {
    return res.status(404).json({ ok: false, error: "Card not found or already answered" });
  }
  pushAnswered(sessionId, cardId, "manual");
  res.json({ ok: true, data: { card } });
});

// S1-T03-E: read the current stack (newest first) for a session.
aiRouter.get("/suggest/:sessionId", requireAuth, (req, res) => {
  const cards = suggestions.allCards(req.params.sessionId);
  res.json({ ok: true, data: { sessionId: req.params.sessionId, cards } });
});
