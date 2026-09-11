import { test } from "node:test";
import assert from "node:assert/strict";
import { AudioBacklog, BACKLOG_SECONDS, frameDurationMs } from "./audioBacklog.ts";

const RATE = 16_000;
/** 250 ms at 16 kHz, every sample set to a marker so order is visible. */
const frame = (marker: number) => new Int16Array(4_000).fill(marker).buffer;
const markerOf = (buf: ArrayBuffer) => new Int16Array(buf)[0];

test("a frame's duration comes from its size and the sample rate", () => {
  assert.equal(frameDurationMs(8_000, 16_000), 250);
  assert.equal(frameDurationMs(24_000, 48_000), 250);
});

test("hands back held frames oldest first with their capture times, and empties", () => {
  const b = new AudioBacklog(RATE);
  b.push(frame(1), 1_000);
  b.push(frame(2), 1_250);
  const { frames, droppedMs } = b.takeAll();
  assert.deepEqual(frames.map((f) => markerOf(f.frame)), [1, 2]);
  assert.deepEqual(frames.map((f) => f.capturedAt), [1_000, 1_250]);
  assert.equal(droppedMs, 0);
  assert.equal(b.isEmpty, true);
});

test("keeps only the newest thirty seconds and says how much was lost", () => {
  const b = new AudioBacklog(RATE);
  const frames32s = BACKLOG_SECONDS * 4 + 8;
  for (let i = 0; i < frames32s; i++) b.push(frame(i), i * 250);
  const { frames, droppedMs } = b.takeAll();
  assert.equal(frames.length, BACKLOG_SECONDS * 4);
  assert.equal(markerOf(frames[0].frame), 8);
  assert.equal(droppedMs, 2_000);
});

test("the lost-audio count resets once it has been reported", () => {
  const b = new AudioBacklog(RATE);
  for (let i = 0; i < BACKLOG_SECONDS * 4 + 4; i++) b.push(frame(i), i);
  b.takeAll();
  b.push(frame(1), 0);
  assert.equal(b.takeAll().droppedMs, 0);
});
