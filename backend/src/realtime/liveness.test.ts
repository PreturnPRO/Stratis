import { test } from "node:test";
import assert from "node:assert/strict";
import { isSessionStale } from "./liveness.ts";

const IDLE = 900_000; // 15 min
const NOW = 1_000_000_000_000;

test("not stale while a facilitator socket is connected", () => {
  assert.equal(
    isSessionStale({ facilitatorCount: 1, lastAudioAt: NOW - IDLE * 2, startedAt: NOW - IDLE * 2, now: NOW, idleLimitMs: IDLE }),
    false,
  );
});

test("not stale when audio is recent", () => {
  assert.equal(
    isSessionStale({ facilitatorCount: 0, lastAudioAt: NOW - 1000, startedAt: NOW - IDLE * 2, now: NOW, idleLimitMs: IDLE }),
    false,
  );
});

test("stale when no socket and audio is older than the idle limit", () => {
  assert.equal(
    isSessionStale({ facilitatorCount: 0, lastAudioAt: NOW - IDLE - 1, startedAt: NOW - IDLE * 2, now: NOW, idleLimitMs: IDLE }),
    true,
  );
});

test("not stale when no audio yet but the session started recently", () => {
  assert.equal(
    isSessionStale({ facilitatorCount: 0, lastAudioAt: null, startedAt: NOW - 5000, now: NOW, idleLimitMs: IDLE }),
    false,
  );
});

test("stale when no audio and the session started long ago", () => {
  assert.equal(
    isSessionStale({ facilitatorCount: 0, lastAudioAt: null, startedAt: NOW - IDLE - 1, now: NOW, idleLimitMs: IDLE }),
    true,
  );
});

test("not stale when there is no basis to judge (no audio, no start time)", () => {
  assert.equal(
    isSessionStale({ facilitatorCount: 0, lastAudioAt: null, startedAt: null, now: NOW, idleLimitMs: IDLE }),
    false,
  );
});
