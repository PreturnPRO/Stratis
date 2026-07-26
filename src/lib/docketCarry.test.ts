import { test } from "node:test";
import assert from "node:assert/strict";
import { carriedInto, unownedCount, type CarryItem } from "./docketCarry.ts";

interface Item extends CarryItem {
  id: string;
}

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id,
  projectId: "apollo",
  sourceMeetingId: "mtg-old",
  sourceAt: "2026-07-01T10:00:00.000Z",
  owner: "Mai",
  ...over,
});

const target = { id: "mtg-next", projectId: "apollo", at: "2026-07-20T10:00:00.000Z" };

test("carries unresolved items forward from earlier meetings on the project", () => {
  const carried = carriedInto([item("a"), item("b")], target);
  assert.deepEqual(carried.map((c) => c.id), ["a", "b"]);
});

test("ignores other projects", () => {
  const carried = carriedInto([item("a", { projectId: "zeus" })], target);
  assert.deepEqual(carried, []);
});

test("does not carry a meeting's own items into itself", () => {
  const carried = carriedInto([item("a", { sourceMeetingId: target.id })], target);
  assert.deepEqual(carried, []);
});

test("does not carry items from later meetings backwards", () => {
  const later = item("a", { sourceAt: "2026-07-25T10:00:00.000Z" });
  assert.deepEqual(carriedInto([later], target), []);
});

test("two meetings on one project carry different sets", () => {
  const items = [
    item("early", { sourceMeetingId: "m1", sourceAt: "2026-07-01T10:00:00.000Z" }),
    item("late", { sourceMeetingId: "m2", sourceAt: "2026-07-15T10:00:00.000Z" }),
  ];
  const second = { id: "m2", projectId: "apollo", at: "2026-07-15T10:00:00.000Z" };
  const third = { id: "m3", projectId: "apollo", at: "2026-07-20T10:00:00.000Z" };

  assert.deepEqual(carriedInto(items, second).map((c) => c.id), ["early"]);
  assert.deepEqual(carriedInto(items, third).map((c) => c.id), ["early", "late"]);
});

test("counts items with no owner", () => {
  assert.equal(unownedCount([item("a", { owner: null }), item("b", { owner: "  " }), item("c")]), 2);
});
