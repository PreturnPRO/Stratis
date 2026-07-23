import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTranscripts } from "./mergeTranscripts.ts";

const row = (id: string, ts: string) => ({ id, timestamp: ts, text: id });

test("merges disjoint sets sorted by timestamp ascending", () => {
  const existing = [row("a", "2026-07-17T10:00:00Z"), row("b", "2026-07-17T10:01:00Z")];
  const incoming = [row("c", "2026-07-17T10:02:00Z")];
  const out = mergeTranscripts(existing, incoming);
  assert.deepEqual(out.map((r) => r.id), ["a", "b", "c"]);
});

test("dedupes overlapping ids (no duplicate rows)", () => {
  const existing = [row("a", "2026-07-17T10:00:00Z"), row("b", "2026-07-17T10:01:00Z")];
  const incoming = [row("b", "2026-07-17T10:01:00Z"), row("c", "2026-07-17T10:02:00Z")];
  const out = mergeTranscripts(existing, incoming);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((r) => r.id), ["a", "b", "c"]);
});

test("incoming wins on id conflict (server row is fresher)", () => {
  const existing = [row("a", "2026-07-17T10:00:00Z")];
  const incoming = [{ id: "a", timestamp: "2026-07-17T10:00:00Z", text: "corrected" }];
  const out = mergeTranscripts(existing, incoming);
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "corrected");
});

test("backfills a gap: rows finalized during a disconnect are inserted in order", () => {
  const existing = [row("a", "2026-07-17T10:00:00Z"), row("d", "2026-07-17T10:03:00Z")];
  const incoming = [row("b", "2026-07-17T10:01:00Z"), row("c", "2026-07-17T10:02:00Z")];
  const out = mergeTranscripts(existing, incoming);
  assert.deepEqual(out.map((r) => r.id), ["a", "b", "c", "d"]);
});

test("empty incoming returns existing, sorted", () => {
  const existing = [row("b", "2026-07-17T10:01:00Z"), row("a", "2026-07-17T10:00:00Z")];
  const out = mergeTranscripts(existing, []);
  assert.deepEqual(out.map((r) => r.id), ["a", "b"]);
});
