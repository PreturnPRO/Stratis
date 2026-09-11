import { test } from "node:test";
import assert from "node:assert/strict";
import { BURST_SECONDS, MAX_REQUEST_BYTES, PendingAudio, splitChunk } from "./pendingAudio.ts";

const RATE = 16_000;
const BYTES_PER_SECOND = RATE * 2;
/** One 250 ms frame at 16 kHz, filled with a marker byte so order is visible. */
const frame = (marker: number) => Buffer.alloc(8_000, marker);

test("releases queued chunks in the order they were pushed", () => {
  const q = new PendingAudio(RATE);
  q.push(frame(1));
  q.push(frame(2));
  q.push(frame(3));
  assert.deepEqual(q.release(0).map((b) => b[0]), [1, 2, 3]);
  assert.equal(q.size, 0);
});

test("drops the oldest audio past ten seconds and reports how much", () => {
  const q = new PendingAudio(RATE);
  let dropped = 0;
  for (let i = 0; i < 44; i++) dropped += q.push(frame(i)); // 11 seconds
  assert.equal(dropped, 4 * 8_000);
  assert.equal(q.size, 10 * BYTES_PER_SECOND);
  assert.equal(q.release(0)[0][0], 4);
});

test("a backlog inside the burst allowance is released at once", () => {
  const q = new PendingAudio(RATE);
  for (let i = 0; i < 3; i++) q.push(frame(i)); // 0.75 s, inside any allowance Task 1 can pick
  assert.equal(q.release(1_000).length, 3);
});

test("a backlog beyond the burst allowance is released at real-time pace", () => {
  const q = new PendingAudio(RATE);
  const burstFrames = Math.floor((q.bytesPerSecond * BURST_SECONDS) / 8_000);
  for (let i = 0; i < 24; i++) q.push(frame(i)); // 6 seconds
  assert.equal(q.release(0).length, burstFrames, "the burst goes at once");
  assert.equal(q.release(0).length, 0, "no time passed, nothing more");
  assert.equal(q.release(500).length, 2, "half a second releases half a second");
  assert.equal(q.release(1_000).length, 2, "the next half second releases the same again");
});

test("unused time never builds more than the burst allowance", () => {
  const q = new PendingAudio(RATE);
  q.release(0);
  for (let i = 0; i < 40; i++) q.push(frame(i));
  assert.equal(q.release(60_000).length, Math.floor((q.bytesPerSecond * BURST_SECONDS) / 8_000));
});

test("releaseAll ignores pacing; clear empties the queue", () => {
  const q = new PendingAudio(RATE);
  for (let i = 0; i < 24; i++) q.push(frame(i));
  assert.equal(q.releaseAll().length, 24);
  q.push(frame(1));
  q.clear();
  assert.equal(q.size, 0);
  assert.equal(q.release(0).length, 0);
});

test("splits a chunk larger than one streaming request on a sample boundary", () => {
  const parts = splitChunk(Buffer.alloc(60_001), MAX_REQUEST_BYTES);
  assert.deepEqual(parts.map((p) => p.length), [25_000, 25_000, 10_001]);
});
