import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult, type CompleteOptions } from "./types";

// Google's Gemini endpoint intermittently returns a transient 5xx (500 internal,
// 503 overloaded, 502/504 from the gateway) when the requested model is under
// load. Those retry cleanly on a lighter model. A 4xx (bad key, bad request)
// would fail identically on any model, so it is NOT retried — it throws at once.
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

async function requestCompletion(
  model: string,
  apiKey: string,
  baseUrl: string,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<Response> {
  return fetchWithTimeout(
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
