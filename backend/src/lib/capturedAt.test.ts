import { test } from "node:test";
import assert from "node:assert/strict";
import { clampCapturedAt } from "./capturedAt.ts";

const STARTED = "2026-09-11T02:00:00.000Z";
const NOW = Date.parse("2026-09-11T02:30:00.000Z");

test("keeps a capture time inside the session", () => {
  assert.equal(clampCapturedAt("2026-09-11T02:10:00.000Z", STARTED, NOW), "2026-09-11T02:10:00.000Z");
});

test("normalises any parseable time to UTC ISO", () => {
  assert.equal(clampCapturedAt("2026-09-11T09:10:00+07:00", STARTED, NOW), "2026-09-11T02:10:00.000Z");
});

test("refuses a time before the session started", () => {
  assert.equal(clampCapturedAt("2026-09-11T01:59:59.000Z", STARTED, NOW), undefined);
});

test("refuses a time in the future", () => {
  assert.equal(clampCapturedAt("2026-09-11T02:30:01.000Z", STARTED, NOW), undefined);
});

test("refuses anything that is not a parseable string", () => {
  for (const raw of [undefined, null, 1_726_020_000_000, "", "yesterday"]) {
    assert.equal(clampCapturedAt(raw, STARTED, NOW), undefined);
  }
});

test("refuses a capture time for a session that never started", () => {
  assert.equal(clampCapturedAt("2026-09-11T02:10:00.000Z", null, NOW), undefined);
});

test("accepts the start as a Date, which is how pg returns TIMESTAMPTZ", () => {
  assert.equal(clampCapturedAt("2026-09-11T02:10:00.000Z", new Date(STARTED), NOW), "2026-09-11T02:10:00.000Z");
});
