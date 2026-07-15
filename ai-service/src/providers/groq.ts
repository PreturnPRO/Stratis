import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult } from "./types";

// Groq free tier for llama-3.3-70b-versatile: 30 requests/min + 12,000 tokens/min.
// When either is exceeded the API returns 429 with a Retry-After (seconds) telling
// us exactly how long to wait — honor it, with a short fallback + hard cap so a
// live-meeting call can't hang forever.
// ponytail: reactive 429 backoff, no proactive token accounting. Add a token
// bucket only if 429s keep firing under normal load.
const MAX_RETRIES = 3;
const MAX_BACKOFF_MS = 10_000;

// 30 req/min → space every request >= 2.1s. Concurrent callers chain off one
// gate promise so bursts serialize into a spaced queue instead of firing at once.
const MIN_REQUEST_INTERVAL_MS = 2100;
let gate: Promise<void> = Promise.resolve();
let lastRequestMs = 0;

function acquireSlot(): Promise<void> {
  const mine = gate.then(async () => {
    const wait = lastRequestMs + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestMs = Date.now();
  });
  // Swallow errors on the shared chain so one failure can't wedge the queue.
  gate = mine.catch(() => {});
  return mine;
}

async function postWithRateLimit(
  url: string,
  init: Parameters<typeof fetchWithTimeout>[1],
  timeoutMs: number,
): Promise<Awaited<ReturnType<typeof fetchWithTimeout>>> {
  for (let attempt = 0; ; attempt++) {
    await acquireSlot();
    const res = await fetchWithTimeout(url, init, timeoutMs);
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;

    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Math.min(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2000 * (attempt + 1),
      MAX_BACKOFF_MS,
    );
    console.warn(
      `[ai:groq] 429 rate limited (30 req/min, 12k tokens/min). ` +
        `Retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms.`,
    );
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export const groqProvider: AIProvider = {
  name: "groq",
  async complete(messages: ChatMessage[]): Promise<CompletionResult> {
    const { apiKey, model, baseUrl } = env.ai.groq;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");

    const res = await postWithRateLimit(
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
      env.ai.timeoutMs
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
