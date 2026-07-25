import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult, type CompleteOptions } from "./types";
import { createPacer, fetchWithRateLimit, type RateLimitOptions } from "./rateLimit";

const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

const GEMINI_RATE_LIMIT: RateLimitOptions = {
  maxRetries: 2,
  maxBackoffMs: 10_000,
  baseBackoffMs: 2000,
};

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
            temperature: 0.1,
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

    throw new Error(`Gemini API error (${lastStatus}): ${lastErrText}`);
  },
};
