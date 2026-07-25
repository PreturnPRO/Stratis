
export interface RateLimitedResponse {
  status: number;
  headers: { get(name: string): string | null };
}

export interface RateLimitOptions {
  maxRetries: number;
  maxBackoffMs: number;
  baseBackoffMs?: number;
}

const DEFAULT_BASE_BACKOFF_MS = 2000;

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function parseRetryAfterMs(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds * 1000;
}

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
      gate = mine.catch(() => {});
      return mine;
    },
  };
}

export interface FetchWithRateLimitOptions extends RateLimitOptions {
  pacer?: Pacer;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: { attempt: number; waitMs: number; status: number }) => void;
}

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
    if (waitMs == null) return res;
    opts.onRetry?.({ attempt, waitMs, status: res.status });
    await sleep(waitMs);
  }
}
