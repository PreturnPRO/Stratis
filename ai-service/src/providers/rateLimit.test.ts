// Tests for the shared provider rate-limit / 429 layer (rateLimit.ts).
//
// This layer is the ONLY thing between the live meeting loop and a free-tier
// 429 storm on the active provider (gemini). It is dependency-free and all
// timing is injectable, so every path is exercised with a fake clock — no real
// timers, no network. Runs under `node --experimental-strip-types --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRetryAfterMs,
  computeRetryDelayMs,
  createPacer,
  fetchWithRateLimit,
  type RateLimitOptions,
  type RateLimitedResponse,
} from "./rateLimit.ts";

// ── parseRetryAfterMs ────────────────────────────────────────────────────────

test("parseRetryAfterMs: whole seconds → ms", () => {
  assert.equal(parseRetryAfterMs("1"), 1000);
  assert.equal(parseRetryAfterMs("30"), 30_000);
  assert.equal(parseRetryAfterMs("0.5"), 500);
  assert.equal(parseRetryAfterMs("  2 "), 2000); // trims whitespace
});

test("parseRetryAfterMs: absent / empty / non-numeric / non-positive → null", () => {
  assert.equal(parseRetryAfterMs(null), null);
  assert.equal(parseRetryAfterMs(undefined), null);
  assert.equal(parseRetryAfterMs(""), null);
  assert.equal(parseRetryAfterMs("   "), null);
  assert.equal(parseRetryAfterMs("soon"), null); // HTTP-date / garbage
  assert.equal(parseRetryAfterMs("0"), null);
  assert.equal(parseRetryAfterMs("-5"), null);
});

// ── computeRetryDelayMs ──────────────────────────────────────────────────────

const OPTS: RateLimitOptions = { maxRetries: 3, maxBackoffMs: 10_000, baseBackoffMs: 2000 };

test("computeRetryDelayMs: honors a Retry-After header (in seconds)", () => {
  assert.equal(computeRetryDelayMs(0, "3", OPTS), 3000);
});

test("computeRetryDelayMs: linear base*(attempt+1) when no Retry-After", () => {
  assert.equal(computeRetryDelayMs(0, null, OPTS), 2000);
  assert.equal(computeRetryDelayMs(1, null, OPTS), 4000);
  assert.equal(computeRetryDelayMs(2, null, OPTS), 6000);
});

test("computeRetryDelayMs: clamps BOTH header and linear backoff to maxBackoffMs", () => {
  const many: RateLimitOptions = { maxRetries: 20, maxBackoffMs: 10_000, baseBackoffMs: 2000 };
  assert.equal(computeRetryDelayMs(0, "600", many), 10_000); // server asked 600s
  assert.equal(computeRetryDelayMs(9, null, many), 10_000); // linear would be 20s
});

test("computeRetryDelayMs: null once retries are exhausted (attempt >= maxRetries)", () => {
  assert.equal(computeRetryDelayMs(3, "1", OPTS), null);
  assert.equal(computeRetryDelayMs(4, null, OPTS), null);
});

test("computeRetryDelayMs: defaults base backoff to 2000 when unset", () => {
  const noBase: RateLimitOptions = { maxRetries: 2, maxBackoffMs: 10_000 };
  assert.equal(computeRetryDelayMs(0, null, noBase), 2000);
});

// ── createPacer ──────────────────────────────────────────────────────────────

/** Deterministic fake clock: sleeping advances "now" by the slept duration. */
function fakeTime(start = 1_000_000) {
  let clock = start;
  const slept: number[] = [];
  return {
    now: () => clock,
    sleep: async (ms: number) => {
      slept.push(ms);
      clock += ms;
    },
    slept,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

test("createPacer: first acquire does not wait", async () => {
  const t = fakeTime();
  const pacer = createPacer(2100, { now: t.now, sleep: t.sleep });
  await pacer.acquire();
  assert.deepEqual(t.slept, []);
});

test("createPacer: a back-to-back second acquire waits the full interval", async () => {
  const t = fakeTime();
  const pacer = createPacer(2100, { now: t.now, sleep: t.sleep });
  await pacer.acquire();
  await pacer.acquire();
  assert.deepEqual(t.slept, [2100]);
});

test("createPacer: no wait once enough time has already elapsed", async () => {
  const t = fakeTime();
  const pacer = createPacer(2100, { now: t.now, sleep: t.sleep });
  await pacer.acquire();
  t.advance(2100); // more than the interval passes between calls
  await pacer.acquire();
  assert.deepEqual(t.slept, []);
});

test("createPacer: serializes a burst into evenly-spaced slots", async () => {
  const t = fakeTime();
  const pacer = createPacer(2100, { now: t.now, sleep: t.sleep });
  // Fire three acquisitions "at once"; they must chain, not all release now.
  await Promise.all([pacer.acquire(), pacer.acquire(), pacer.acquire()]);
  assert.deepEqual(t.slept, [2100, 2100]); // 1st free, 2nd + 3rd each spaced
});

test("createPacer: minInterval 0 disables spacing entirely", async () => {
  const t = fakeTime();
  const pacer = createPacer(0, { now: t.now, sleep: t.sleep });
  await pacer.acquire();
  await pacer.acquire();
  assert.deepEqual(t.slept, []);
});

// ── fetchWithRateLimit ───────────────────────────────────────────────────────

/** Minimal Response-shaped stub. */
function resp(status: number, retryAfter?: string): RateLimitedResponse {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === "retry-after" ? retryAfter ?? null : null) },
  };
}

/** A doFetch that yields the given sequence of responses, one per call. */
function sequence(...responses: RateLimitedResponse[]) {
  let i = 0;
  const calls = { count: 0 };
  const doFetch = async () => {
    calls.count++;
    return responses[Math.min(i++, responses.length - 1)];
  };
  return { doFetch, calls };
}

test("fetchWithRateLimit: returns a 200 immediately without sleeping", async () => {
  const t = fakeTime();
  const { doFetch, calls } = sequence(resp(200));
  const res = await fetchWithRateLimit(doFetch, { ...OPTS, sleep: t.sleep });
  assert.equal(res.status, 200);
  assert.equal(calls.count, 1);
  assert.deepEqual(t.slept, []);
});

test("fetchWithRateLimit: retries a 429 then succeeds, honoring Retry-After", async () => {
  const t = fakeTime();
  const retries: number[] = [];
  const { doFetch, calls } = sequence(resp(429, "2"), resp(200));
  const res = await fetchWithRateLimit(doFetch, {
    ...OPTS,
    sleep: t.sleep,
    onRetry: ({ waitMs }) => retries.push(waitMs),
  });
  assert.equal(res.status, 200);
  assert.equal(calls.count, 2);
  assert.deepEqual(t.slept, [2000]); // waited the server-instructed 2s
  assert.deepEqual(retries, [2000]);
});

test("fetchWithRateLimit: returns the final 429 once retries are exhausted", async () => {
  const t = fakeTime();
  const opts: RateLimitOptions = { maxRetries: 2, maxBackoffMs: 10_000, baseBackoffMs: 2000 };
  const { doFetch, calls } = sequence(resp(429), resp(429), resp(429), resp(429));
  const res = await fetchWithRateLimit(doFetch, { ...opts, sleep: t.sleep });
  assert.equal(res.status, 429); // surfaced, not thrown — caller's !res.ok handles it
  assert.equal(calls.count, 3); // initial + 2 retries
  assert.deepEqual(t.slept, [2000, 4000]); // linear backoff between attempts
});

test("fetchWithRateLimit: a non-429 error (500) returns at once for the caller", async () => {
  const t = fakeTime();
  const { doFetch, calls } = sequence(resp(500));
  const res = await fetchWithRateLimit(doFetch, { ...OPTS, sleep: t.sleep });
  assert.equal(res.status, 500); // 5xx is the provider's concern (model fallback), not ours
  assert.equal(calls.count, 1);
  assert.deepEqual(t.slept, []);
});

test("fetchWithRateLimit: acquires the pacer before every attempt", async () => {
  const t = fakeTime();
  let acquisitions = 0;
  const pacer = { acquire: async () => { acquisitions++; } };
  const { doFetch } = sequence(resp(429), resp(429), resp(200));
  await fetchWithRateLimit(doFetch, { ...OPTS, sleep: t.sleep, pacer });
  assert.equal(acquisitions, 3); // one per HTTP attempt (each hits the quota)
});
