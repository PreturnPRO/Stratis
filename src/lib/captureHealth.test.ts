import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REOPEN_ATTEMPTS,
  REOPEN_BACKOFF_MS,
  WATCHDOG_MS,
  initialHealth,
  stepHealth,
  type CaptureEvent,
  type CaptureHealth,
} from "./captureHealth.ts";

function run(start: CaptureHealth, events: CaptureEvent[]) {
  let health = start;
  const actions: string[] = [];
  for (const event of events) {
    const next = stepHealth(health, event);
    health = next.health;
    actions.push(next.action);
  }
  return { health, actions };
}

test("stays live while frames keep arriving", () => {
  const { health, actions } = run(initialHealth(0), [
    { type: "tick", at: 1_000, lastFrameAt: 990 },
    { type: "tick", at: 9_000, lastFrameAt: 8_990 },
  ]);
  assert.equal(health.status, "live");
  assert.deepEqual(actions, ["none", "none"]);
});

test("five seconds without a frame starts a reopen", () => {
  const next = stepHealth(initialHealth(0), { type: "tick", at: WATCHDOG_MS + 1, lastFrameAt: 0 });
  assert.equal(next.health.status, "recovering");
  assert.equal(next.action, "reopen");
});

test("the watchdog counts from when capture started, not from the epoch", () => {
  const next = stepHealth(initialHealth(100_000), { type: "tick", at: 101_000, lastFrameAt: 0 });
  assert.equal(next.health.status, "live");
});

test("a track that ends starts a reopen at once", () => {
  assert.equal(stepHealth(initialHealth(0), { type: "track-ended", at: 10 }).action, "reopen");
});

test("a suspended context is resumed before anything is reopened", () => {
  const { health, actions } = run(initialHealth(0), [
    { type: "context-suspended", at: 100 },
    { type: "tick", at: 600, lastFrameAt: 550 },
  ]);
  assert.deepEqual(actions, ["resume-context", "none"]);
  assert.equal(health.status, "live");
});

test("a context that stays silent after resuming is reopened", () => {
  const { actions } = run(initialHealth(0), [
    { type: "context-suspended", at: 100 },
    { type: "tick", at: 1_200, lastFrameAt: 50 },
  ]);
  assert.deepEqual(actions, ["resume-context", "reopen"]);
});

test("a successful reopen returns to live", () => {
  const { health } = run(initialHealth(0), [
    { type: "track-ended", at: 10 },
    { type: "reopen-succeeded", at: 400 },
  ]);
  assert.equal(health.status, "live");
  assert.equal(health.attempts, 0);
});

test("nothing is reopened while a reopen is already running", () => {
  const reopening = stepHealth(initialHealth(0), { type: "track-ended", at: 0 }).health;
  assert.equal(stepHealth(reopening, { type: "tick", at: 60_000, lastFrameAt: 0 }).action, "none");
});

test("failed reopens wait 1s, 2s, 4s, 4s, and the fifth failure is lost", () => {
  let health = stepHealth(initialHealth(0), { type: "track-ended", at: 0 }).health;
  let at = 0;
  const waits: number[] = [];
  for (let attempt = 1; attempt < MAX_REOPEN_ATTEMPTS; attempt++) {
    health = stepHealth(health, { type: "reopen-failed", at }).health;
    assert.equal(health.status, "recovering");
    waits.push(health.nextAttemptAt! - at);
    const early = stepHealth(health, { type: "tick", at: health.nextAttemptAt! - 1, lastFrameAt: 0 });
    assert.equal(early.action, "none", "no reopen before the wait is over");
    at = health.nextAttemptAt!;
    const due = stepHealth(health, { type: "tick", at, lastFrameAt: 0 });
    assert.equal(due.action, "reopen");
    health = due.health;
  }
  assert.deepEqual(waits, [...REOPEN_BACKOFF_MS]);
  assert.equal(stepHealth(health, { type: "reopen-failed", at }).health.status, "lost");
});

test("lost stays lost until someone presses Try again", () => {
  const lost: CaptureHealth = { status: "lost", since: 0, attempts: 5, nextAttemptAt: null, reopening: false };
  assert.equal(stepHealth(lost, { type: "tick", at: 60_000, lastFrameAt: 0 }).health.status, "lost");
  const retried = stepHealth(lost, { type: "retry", at: 60_000 });
  assert.equal(retried.action, "reopen");
  assert.equal(retried.health.status, "recovering");
});
