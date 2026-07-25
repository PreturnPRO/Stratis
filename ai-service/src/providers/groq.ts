import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult } from "./types";
import { createPacer, fetchWithRateLimit, type RateLimitOptions } from "./rateLimit";

// Groq free tier for llama-3.3-70b-versatile: 30 requests/min + 12,000 tokens/min.
// When either is exceeded the API returns 429 with a Retry-After (seconds) telling
// us exactly how long to wait — honor it, with a short fallback + hard cap so a
// live-meeting call can't hang forever. Both behaviours now live in the shared
// ./rateLimit layer (used by gemini + typhoon too); this file just parameterises it.
// ponytail: reactive 429 backoff, no proactive token accounting. Add a token
// bucket only if 429s keep firing under normal load.
const GROQ_RATE_LIMIT: RateLimitOptions = {
  maxRetries: 3,
  maxBackoffMs: 10_000,
  baseBackoffMs: 2000,
};

// 30 req/min → space every request >= 2.1s. Concurrent callers chain off one
// pacer promise so bursts serialize into a spaced queue instead of firing at once.
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
              temperature: 0.1, // precision focus: eliminates formatting drift
              max_tokens: 4096,  // ample token window to prevent JSON structure truncation
              response_format: { type: "json_object" } // hard constraint for json compliance
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

    return { text, provider: "groq", raw: payload };
  },
};
