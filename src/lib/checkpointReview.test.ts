import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldInterruptEnd, unreviewedIds } from "./checkpointReview.ts";

test("unseen decisions count as unreviewed", () => {
  const decisions = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(unreviewedIds(decisions, ["a"]), ["b", "c"]);
});

test("dismissed decisions never count as unreviewed", () => {
  const decisions = [{ id: "a", dismissed: true }, { id: "b" }];
  assert.deepEqual(unreviewedIds(decisions, []), ["b"]);
});

test("nothing is unreviewed once every id has been seen", () => {
  const decisions = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(unreviewedIds(decisions, ["a", "b"]), []);
});

test("interrupts when something has not been reviewed", () => {
  assert.equal(
    shouldInterruptEnd({ unreviewed: 2, extracting: false, everOpened: true }),
    true,
  );
});

test("interrupts while extraction is still running, even with nothing unreviewed", () => {
  assert.equal(
    shouldInterruptEnd({ unreviewed: 0, extracting: true, everOpened: true }),
    true,
  );
});

test("interrupts when the panel was never opened", () => {
  assert.equal(
    shouldInterruptEnd({ unreviewed: 0, extracting: false, everOpened: false }),
    true,
  );
});

test("does not interrupt when everything was reviewed and nothing is in flight", () => {
  assert.equal(
    shouldInterruptEnd({ unreviewed: 0, extracting: false, everOpened: true }),
    false,
  );
});
