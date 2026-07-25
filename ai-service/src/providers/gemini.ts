import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult, type CompleteOptions } from "./types";
import { createPacer, fetchWithRateLimit, type RateLimitOptions } from "./rateLimit";

// Google's Gemini endpoint intermittently returns a transient 5xx (500 internal,
// 503 overloaded, 502/504 from the gateway) when the requested model is under
// load. Those retry cleanly on a lighter model. A 4xx (bad key, bad request)
// would fail identically on any model, so it is NOT retried — it throws at once.
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

// A 429 is a DIFFERENT failure: the free tier's quota (15 req/min, 500 req/day)
// is exhausted. Switching to the fallback model does NOT help — the fallback
// shares the same GEMINI_API_KEY / project quota (env.ts). So a 429 is handled
// in-place: honor the Retry-After the endpoint returns, with a linear fallback
// and a hard cap, then retry the SAME model. Only after 429 retries are
// exhausted does it surface (and, since 429 is not in RETRYABLE_STATUSES, it
// throws rather than wasting a request on the already-quota-limited fallback).
const GEMINI_RATE_LIMIT: RateLimitOptions = {
  maxRetries: 2,
  maxBackoffMs: 10_000,
  baseBackoffMs: 2000,
};

// Proactive spacer shared by EVERY gemini request in this process — every
// session's live-card loop plus the meeting-end doc-patch and decision-extract
// calls. The per-session live-card gate (AI_MIN_CALL_INTERVAL_MS in
// transcript.ts) paces ONE session; it can't stop N concurrent meetings, or the
// two non-live call paths, from collectively outrunning the 15 req/min project
// quota. This pacer does. In the common single-session case requests already
// arrive >4s apart, so it adds zero wait; it only bites under real bursts.
const geminiPacer = createPacer(env.ai.gemini.minRequestIntervalMs);

async function requestCompletion(
  model: string,
  apiKey: string,
  baseUrl: string,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<Response> {
  return fetchWithRateLimit(
    () =>
      fetchWithTimeout(
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.1, // A low temperature is critical to strictly respect our JSON schema guidelines [288]
            // Gemini 3 models think before answering; default effort runs past
            // AI_TIMEOUT_MS on live-card prompts. Low effort keeps latency
            // inside the live-meeting budget.
            reasoning_effort: "low",
          }),
        },
        timeoutMs,
      ),
    {
      ...GEMINI_RATE_LIMIT,
      pacer: geminiPacer,
      onRetry: ({ attempt, waitMs }) =>
        console.warn(
          `[ai:gemini] 429 quota (free tier 15 req/min, 500 req/day) on ` +
            `"${model}"; retry ${attempt + 1}/${GEMINI_RATE_LIMIT.maxRetries} ` +
            `in ${waitMs}ms.`,
        ),
    },
  );
}

export const geminiProvider: AIProvider = {
  name: "gemini",
  async complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<CompletionResult> {
    const { apiKey, model, fallbackModel, baseUrl } = env.ai.gemini;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in the environment variables.");
    }

    const timeoutMs = opts?.timeoutMs ?? env.ai.timeoutMs;

    // Primary first, then the overflow model if configured and distinct. A hung
    // model aborts inside fetchWithTimeout and throws straight out — only a fast
    // 5xx response falls through to the fallback, so live-card latency stays
    // bounded by a single timeout, not two.
    const models =
      fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];

    let lastStatus = 0;
    let lastErrText = "";

    for (let i = 0; i < models.length; i++) {
      const activeModel = models[i];
      const res = await requestCompletion(activeModel, apiKey, baseUrl, messages, timeoutMs);

      if (res.ok) {
        const payload = await res.json() as any;
        const text = payload.choices?.[0]?.message?.content ?? "";
        if (i > 0) {
          console.warn(
            `[ai] gemini primary "${model}" failed with ${lastStatus}; ` +
              `served by fallback "${activeModel}".`,
          );
        }
        return {
          text,
          provider: "gemini",
          raw: payload,
        };
      }

      lastStatus = res.status;
      lastErrText = await res.text();

      const hasFallback = i < models.length - 1;
      if (!RETRYABLE_STATUSES.has(res.status) || !hasFallback) {
        throw new Error(`Gemini API error (${res.status}): ${lastErrText}`);
      }
      console.warn(
        `[ai] gemini model "${activeModel}" returned ${res.status}; ` +
          `retrying on fallback "${models[i + 1]}".`,
      );
    }

    // Loop always returns on success or throws on the last failure; this only
    // guards the impossible empty-models case.
    throw new Error(`Gemini API error (${lastStatus}): ${lastErrText}`);
  },
};
