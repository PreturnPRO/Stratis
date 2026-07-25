import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult } from "./types";
import { createPacer, fetchWithRateLimit, type RateLimitOptions } from "./rateLimit";

const GROQ_RATE_LIMIT: RateLimitOptions = {
  maxRetries: 3,
  maxBackoffMs: 10_000,
  baseBackoffMs: 2000,
};

const groqPacer = createPacer(2100);

export const groqProvider: AIProvider = {
  name: "groq",
  async complete(messages: ChatMessage[]): Promise<CompletionResult> {
    const { apiKey, model, baseUrl } = env.ai.groq;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");

    const res = await fetchWithRateLimit(
      () =>
        fetchWithTimeout(
          `${baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.1,
              max_tokens: 4096,
              response_format: { type: "json_object" }
            }),
          },
          env.ai.timeoutMs,
        ),
      {
        ...GROQ_RATE_LIMIT,
        pacer: groqPacer,
        onRetry: ({ attempt, waitMs }) =>
          console.warn(
            `[ai:groq] 429 rate limited (30 req/min, 12k tokens/min). ` +
              `Retry ${attempt + 1}/${GROQ_RATE_LIMIT.maxRetries} in ${waitMs}ms.`,
          ),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq API error: ${res.status} ${errorText}`);
    }

    const payload = (await res.json()) as {
      choices?: {
        message?: {
          content?: string;
        };
      }[];
    };

    const [firstChoice] = payload.choices ?? [];
    const text = firstChoice?.message?.content ?? "";

    return { text, provider: "groq", raw: payload };
  },
};
