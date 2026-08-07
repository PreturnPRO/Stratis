import { test } from "node:test";
import assert from "node:assert/strict";
import { toggleOpenStatus } from "./decisionStatus.ts";

test("parks a committed decision as open", () => {
  assert.equal(toggleOpenStatus("incomplete", null), "open");
  assert.equal(toggleOpenStatus("complete", "2026-08-01"), "open");
});

test("an open decision without a date comes back as incomplete", () => {
  assert.equal(toggleOpenStatus("open", null), "incomplete");
});

test("an open decision that kept its date comes back as complete", () => {
  assert.equal(toggleOpenStatus("open", "2026-08-01"), "complete");
});

test("parking is reversible from every status", () => {
  for (const dueDate of [null, "2026-08-01"]) {
    const parked = toggleOpenStatus("incomplete", dueDate);
    assert.equal(parked, "open");
    assert.notEqual(toggleOpenStatus(parked, dueDate), "open");
  }
});
