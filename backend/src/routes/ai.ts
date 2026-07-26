import { Router } from "express";
import { firstCall, structuredCall } from "@ai/index";
import { requireAuth } from "../auth/middleware";
import * as suggestions from "../realtime/suggestions";
import { detectAnswered } from "../realtime/autodetect";
import { pushSuggestion, pushAnswered } from "../realtime/hub";
import { placeholder } from "./_placeholder";
import { validateAiOutput } from "../middleware/validateAiOutput";

export const aiRouter = Router();

aiRouter.get(
  "/",
  placeholder(
    "ai",
    "POST/GET /api/ai/test sends a hardcoded prompt (S1-T03-B)",
  ),
);

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

aiRouter.post("/structure", async (req, res, next) => {
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

aiRouter.post("/suggest", requireAuth, async (req, res, next) => {
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

aiRouter.post("/suggest/scan", requireAuth, (req, res) => {
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

aiRouter.post("/suggest/answer", requireAuth, (req, res) => {
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
      .json({
        ok: false,
        error: "Only the facilitator can mark cards answered",
      });
  }

  const card = suggestions.markAnswered(sessionId, cardId, "manual");
  if (!card) {
    return res
      .status(404)
      .json({ ok: false, error: "Card not found or already answered" });
  }
  pushAnswered(sessionId, cardId, "manual");
  res.json({ ok: true, data: { card } });
});

aiRouter.post("/suggest/dismiss", requireAuth, (req, res) => {
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

aiRouter.get("/suggest/:sessionId", requireAuth, async (req, res, next) => {
  try {
    await suggestions.hydrate(req.params.sessionId);
    const cards = suggestions.allCards(req.params.sessionId);
    res.json({ ok: true, data: { sessionId: req.params.sessionId, cards } });
  } catch (err) {
    next(err);
  }
});
