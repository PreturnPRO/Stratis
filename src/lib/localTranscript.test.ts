import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

/**
 * A fake localStorage, because the rules worth testing here are about what
 * survives and what is deleted — not about the browser.
 */
class MemoryStorage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

const storage = new MemoryStorage();
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

const {
  clearLocalTranscript,
  loadLocalTranscript,
  orphanedTranscripts,
  saveLocalTranscript,
  toPlainText,
} = await import("./localTranscript.ts");

const lines = [
  { speaker: "Sarah K.", text: "ตกลงว่าเราจะเปิดตัวด้วย Free tier", timestamp: "2026-08-14T02:12:00.000Z" },
  { speaker: "Mike R.", text: "ใครดูแล onboarding", timestamp: "2026-08-14T02:20:00.000Z" },
];

beforeEach(() => storage.clear());

test("a transcript is kept for the session it belongs to", () => {
  saveLocalTranscript("s1", lines, { meetingTitle: "Pricing review" });

  const loaded = loadLocalTranscript("s1");
  assert.equal(loaded?.lines.length, 2);
  assert.equal(loaded?.meetingTitle, "Pricing review");
  assert.equal(loaded?.lines[0].text, "ตกลงว่าเราจะเปิดตัวด้วย Free tier");
});

test("saving replaces rather than appends, so a reconnect cannot double the text", () => {
  saveLocalTranscript("s1", lines);
  saveLocalTranscript("s1", [...lines, { speaker: "A", text: "third", timestamp: "2026-08-14T02:30:00.000Z" }]);

  assert.equal(loadLocalTranscript("s1")?.lines.length, 3);
});

test("an empty transcript is not written — an empty file is worse than none", () => {
  saveLocalTranscript("s1", []);
  assert.equal(loadLocalTranscript("s1"), null);
});

test("the start time is kept from the first save, not moved by later ones", () => {
  saveLocalTranscript("s1", lines);
  const first = loadLocalTranscript("s1")?.startedAt;

  saveLocalTranscript("s1", [...lines, { speaker: "B", text: "later", timestamp: "2026-08-14T03:00:00.000Z" }]);
  assert.equal(loadLocalTranscript("s1")?.startedAt, first);
});

test("clearing removes only that session", () => {
  saveLocalTranscript("s1", lines);
  saveLocalTranscript("s2", lines);

  clearLocalTranscript("s1");

  assert.equal(loadLocalTranscript("s1"), null);
  assert.equal(loadLocalTranscript("s2")?.lines.length, 2);
});

test("orphans are every session still held, newest first", () => {
  saveLocalTranscript("older", lines);
  saveLocalTranscript("newer", lines);

  const found = orphanedTranscripts();
  assert.equal(found.length, 2);
  assert.ok(found[0].updatedAt >= found[1].updatedAt);
});

test("a corrupt entry does not hide the healthy ones", () => {
  saveLocalTranscript("good", lines);
  storage.setItem("stratis.transcript.broken", "{not json");

  assert.deepEqual(
    orphanedTranscripts().map((r) => r.sessionId),
    ["good"],
  );
});

test("unrelated keys are left alone", () => {
  storage.setItem("stratis.auth.v1", "{}");
  saveLocalTranscript("s1", lines);

  assert.equal(orphanedTranscripts().length, 1);
  assert.equal(storage.getItem("stratis.auth.v1"), "{}");
});

test("the plain text carries who said what, and when", () => {
  saveLocalTranscript("s1", lines, { meetingTitle: "Pricing review" });
  const text = toPlainText(loadLocalTranscript("s1")!);

  assert.match(text, /Pricing review/);
  assert.match(text, /Sarah K\.: ตกลงว่าเราจะเปิดตัวด้วย Free tier/);
  assert.match(text, /Mike R\.: ใครดูแล onboarding/);
});

test("a very long meeting drops its opening rather than losing the write", () => {
  const many = Array.from({ length: 20_000 }, (_, i) => ({
    speaker: "Speaker",
    text: `line ${i} ${"ก".repeat(40)}`,
    timestamp: "2026-08-14T02:12:00.000Z",
  }));

  saveLocalTranscript("s1", many);

  const kept = loadLocalTranscript("s1");
  assert.ok(kept, "something must be stored");
  assert.ok(kept!.lines.length > 50, "not everything is thrown away");
  assert.ok(kept!.lines.length < many.length, "the oldest lines are dropped");
  // The end of the meeting — where the decisions are — always survives.
  assert.equal(kept!.lines.at(-1)?.text, many.at(-1)?.text);
});
