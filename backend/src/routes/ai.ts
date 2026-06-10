// /api/ai (S1-T03-B). Sends a hardcoded test prompt to the configured AI
// provider, logs the raw response server-side, and returns it.
// Structured-JSON output + validation comes in S1-T03-C / S1-T05.
import { Router } from "express";
import { firstCall, structuredCall } from "@ai/index";
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
