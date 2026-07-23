import { test } from "node:test";
import assert from "node:assert/strict";
import { streamAction, isOpenWedged, openBackoffMs } from "./sttStreamPolicy.ts";

const NOW = 1_000_000_000_000;
const ROTATE = 240_000; // proactive age rotation (matches sttStream.ts)
const STALL = 30_000; // frames flowing but zero results → assume dead stream

// ── streamAction ─────────────────────────────────────────────────────────────

test("keeps a fresh stream that is producing results", () => {
  assert.equal(
    streamAction({
      now: NOW,
      streamStartedAt: NOW - 10_000,
      lastDataAt: NOW - 2_000,
      rotateAfterMs: ROTATE,
      stallAfterMs: STALL,
    }),
    "keep",
  );
});

test("rotates at the age limit even when results are flowing", () => {
  assert.equal(
    streamAction({
      now: NOW,
      streamStartedAt: NOW - ROTATE - 1,
      lastDataAt: NOW - 1_000,
      rotateAfterMs: ROTATE,
      stallAfterMs: STALL,
    }),
    "rotate",
  );
});

test("rotates a stalled stream: open, past stall window, no results since", () => {
  assert.equal(
    streamAction({
      now: NOW,
      streamStartedAt: NOW - 60_000,
      lastDataAt: NOW - STALL - 1,
      rotateAfterMs: ROTATE,
      stallAfterMs: STALL,
    }),
    "rotate",
  );
});

test("stall clock starts at stream open when no result has ever arrived", () => {
  assert.equal(
    streamAction({
      now: NOW,
      streamStartedAt: NOW - STALL - 1,
      lastDataAt: null,
      rotateAfterMs: ROTATE,
      stallAfterMs: STALL,
    }),
    "rotate",
  );
});

test("keeps a young silent stream (no result yet, under stall window)", () => {
  assert.equal(
    streamAction({
      now: NOW,
      streamStartedAt: NOW - STALL + 5_000,
      lastDataAt: null,
      rotateAfterMs: ROTATE,
      stallAfterMs: STALL,
    }),
    "keep",
  );
});

// ── isOpenWedged ─────────────────────────────────────────────────────────────

test("no open attempt in flight is not wedged", () => {
  assert.equal(
    isOpenWedged({ now: NOW, openingStartedAt: null, timeoutMs: 10_000 }),
    false,
  );
});

test("open attempt under the timeout is not wedged", () => {
  assert.equal(
    isOpenWedged({ now: NOW, openingStartedAt: NOW - 9_999, timeoutMs: 10_000 }),
    false,
  );
});

test("open attempt past the timeout is wedged and must be abandoned", () => {
  assert.equal(
    isOpenWedged({ now: NOW, openingStartedAt: NOW - 10_001, timeoutMs: 10_000 }),
    true,
  );
});

// ── openBackoffMs ────────────────────────────────────────────────────────────

test("no failures means no backoff", () => {
  assert.equal(openBackoffMs(0), 0);
});

test("backoff doubles per consecutive failure", () => {
  assert.equal(openBackoffMs(1), 2_000);
  assert.equal(openBackoffMs(2), 4_000);
  assert.equal(openBackoffMs(3), 8_000);
});

test("backoff is capped", () => {
  assert.equal(openBackoffMs(10), 30_000);
});
