// Generic async retry with exponential backoff.
//
// Runs `fn`, and on rejection retries up to `retries` more times, waiting
// `baseMs * 2^attempt` between tries (attempt 0 is the wait after the first
// failure). Resolves with the first success; rejects with the last error once
// retries are exhausted. Used to survive transient DB blips when persisting a
// finalized transcript utterance (see routes/transcript.ts streamIngest).

export interface RetryOptions {
  /** Retries after the initial attempt. Total attempts = retries + 1. */
  retries?: number;
  /** Base backoff in ms; doubles each retry. */
  baseMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 200;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(baseMs * 2 ** attempt);
    }
  }
  throw lastError;
}
