// Shared provider rate-limit / 429 layer.
//
// Every OpenAI-compatible cloud provider we call (Groq, Gemini, Typhoon) shares
// the same two problems on a free tier:
//   1. Reactive: the endpoint returns 429 with a `Retry-After` (seconds) telling
//      us exactly how long to wait. Honor it, with a linear fallback + a hard
//      cap so a live-meeting call can't hang forever.
//   2. Proactive: firing requests as fast as transcript rows arrive burns the
//      requests-per-minute quota. A serialized pacer spaces requests so bursts
//      (concurrent meetings, or the doc-patch + decision-extract calls at
//      meeting end) queue instead of all firing at once.
//
// This file is intentionally DEPENDENCY-FREE (no imports at all): it must stay
// importable by `node --experimental-strip-types --test`, which cannot resolve
// extensionless relative imports. All timing is injectable so the logic is
// unit-tested with a fake clock instead of real timers. Providers wire it to
// the real `fetch` Response, which structurally satisfies RateLimitedResponse.

/** The slice of a fetch `Response` this layer needs. `Response` satisfies it. */
export interface RateLimitedResponse {
  status: number;
  headers: { get(name: string): string | null };
}

export interface RateLimitOptions {
  /** Retries AFTER the first attempt. Total attempts = maxRetries + 1. */
  maxRetries: number;
  /** Absolute ceiling on any single backoff wait (ms). */
  maxBackoffMs: number;
  /** Backoff base used when the response carries no usable Retry-After header.
   *  Wait grows linearly as base * (attempt + 1). Defaults to 2000ms. */
  baseBackoffMs?: number;
}

const DEFAULT_BASE_BACKOFF_MS = 2000;

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parse an HTTP `Retry-After` value expressed in whole seconds into ms.
 * Returns null when the header is absent, non-numeric, or non-positive. The
 * OpenAI-compatible endpoints we use send the delta-seconds form, not the
 * HTTP-date form, so only seconds are handled (mirrors the previous inline
 * `Number(res.headers.get("retry-after"))` in groq.ts).
 */
export function parseRetryAfterMs(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds * 1000;
}

/**
 * How long to wait before retrying a 429, or null when retries are exhausted
 * (attempt is 0-based: 0 is the wait before the FIRST retry). Honors
 * Retry-After when present; otherwise a linear base * (attempt + 1). The result
 * — including a Retry-After the server asked for — is always clamped to
 * maxBackoffMs so one call can never stall past the cap.
 */
export function computeRetryDelayMs(
  attempt: number,
  retryAfterHeader: string | null | undefined,
  opts: RateLimitOptions,
): number | null {
  if (attempt >= opts.maxRetries) return null;
  const base = opts.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const fromHeader = parseRetryAfterMs(retryAfterHeader);
  const raw = fromHeader ?? base * (attempt + 1);
  return Math.min(raw, opts.maxBackoffMs);
}

/** Serialized request spacer. `acquire()` resolves only once at least
 *  minIntervalMs has elapsed since the previous acquisition. Concurrent callers
 *  chain off one shared promise so bursts serialize into a spaced queue rather
 *  than all firing at once (the pattern groq.ts used inline). */
export interface Pacer {
  acquire(): Promise<void>;
}

export interface PacerDeps {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function createPacer(minIntervalMs: number, deps: PacerDeps = {}): Pacer {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? realSleep;

  // The shared chain: each acquire waits for the previous one to release, so
  // spacing is measured tail-to-head across concurrent callers.
  let gate: Promise<void> = Promise.resolve();
  let lastAt = 0;

  return {
    acquire(): Promise<void> {
      const mine = gate.then(async () => {
        if (minIntervalMs > 0) {
          const wait = lastAt + minIntervalMs - now();
          if (wait > 0) await sleep(wait);
        }
        lastAt = now();
      });
      // Swallow errors on the shared chain so one failure can't wedge the queue.
      gate = mine.catch(() => {});
      return mine;
    },
  };
}

export interface FetchWithRateLimitOptions extends RateLimitOptions {
  /** Optional proactive spacer; acquired before EVERY attempt (each attempt is
   *  a real HTTP request against the quota). */
  pacer?: Pacer;
  /** Injectable for tests; defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Notified before each 429 backoff (for a provider-specific log line). */
  onRetry?: (info: { attempt: number; waitMs: number; status: number }) => void;
}

/**
 * Run `doFetch`, and on a 429 wait per {@link computeRetryDelayMs} and retry the
 * SAME request. Any non-429 (success OR a hard error like 400/500) returns
 * immediately for the caller to handle — 5xx retry/model-fallback stays the
 * provider's concern. When 429 retries are exhausted the final 429 response is
 * returned (not thrown), exactly as the caller's existing `!res.ok` branch
 * expects.
 */
export async function fetchWithRateLimit<R extends RateLimitedResponse>(
  doFetch: () => Promise<R>,
  opts: FetchWithRateLimitOptions,
): Promise<R> {
  const sleep = opts.sleep ?? realSleep;
  for (let attempt = 0; ; attempt++) {
    if (opts.pacer) await opts.pacer.acquire();
    const res = await doFetch();
    if (res.status !== 429) return res;

    const waitMs = computeRetryDelayMs(
      attempt,
      res.headers.get("retry-after"),
      opts,
    );
    if (waitMs == null) return res; // retries exhausted — surface the 429
    opts.onRetry?.({ attempt, waitMs, status: res.status });
    await sleep(waitMs);
  }
}
