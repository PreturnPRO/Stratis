import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult } from "./types";
import { createPacer, fetchWithRateLimit, type RateLimitOptions } from "./rateLimit";

// Typhoon's hosted API rate-limits like any other cloud endpoint. Reuse the
// shared 429 layer (honor Retry-After, capped linear backoff) + a proactive
// pacer so a busy meeting can't hammer it into 429s. Constants are conservative;
// tune if Typhoon becomes the primary provider.
const TYPHOON_RATE_LIMIT: RateLimitOptions = {
  maxRetries: 2,
  maxBackoffMs: 10_000,
  baseBackoffMs: 2000,
};
const typhoonPacer = createPacer(2100);

export const typhoonProvider: AIProvider = {
  name: "typhoon",
  async complete(messages: ChatMessage[]): Promise<CompletionResult> {
    const { apiKey, model, baseUrl } = env.ai.typhoon;
    if (!apiKey) throw new Error("TYPHOON_API_KEY is not set");

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
              temperature: 0.1, // precision focus
              max_tokens: 4096,  // large prediction limit
            }),
          },
          env.ai.timeoutMs,
        ),
      {
        ...TYPHOON_RATE_LIMIT,
        pacer: typhoonPacer,
        onRetry: ({ attempt, waitMs }) =>
          console.warn(
            `[ai:typhoon] 429 rate limited. ` +
              `Retry ${attempt + 1}/${TYPHOON_RATE_LIMIT.maxRetries} in ${waitMs}ms.`,
          ),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Typhoon API error: ${res.status} ${errorText}`);
    }

    // Type-assertion cast: satisfies strict compilation parameters by defining the expected envelope shape
    const payload = (await res.json()) as {
      choices?: {
        message?: {
          content?: string;
        };
      }[];
    };

    // Bracket-free destructuring safely extracts the first array item
    const [firstChoice] = payload.choices ?? [];
    const text = firstChoice?.message?.content ?? "";

    return { text, provider: "typhoon", raw: payload };
  },
};
