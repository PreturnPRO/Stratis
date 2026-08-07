import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeMemory,
  shouldReplaceMemory,
  MAX_TOTAL_BULLETS,
} from "./rollingMemory.ts";

test("collapses bullets that restate an earlier one", () => {
  const memory = [
    "## Key points",
    "- We ship the beta on Friday",
    "- The beta ships on Friday",
    "- Pricing stays at 39 dollars",
  ].join("\n");

  const out = dedupeMemory(memory);
  const bullets = out.split("\n").filter((l) => l.startsWith("- "));

  assert.equal(bullets.length, 2);
  assert.ok(bullets[0].includes("ship the beta on Friday"));
  assert.ok(bullets[1].includes("Pricing"));
});

test("keeps the first phrasing, not the restatement", () => {
  const out = dedupeMemory("- Mai owns the migration\n- Migration is owned by Mai");
  assert.ok(out.includes("Mai owns the migration"));
  assert.ok(!out.includes("Migration is owned by Mai"));
});

test("dedupes across sections, not just within one", () => {
  const memory = [
    "## Key points",
    "- We ship the beta on Friday",
    "## Open threads",
    "- We ship the beta on Friday",
    "- Who signs off on pricing?",
  ].join("\n");

  const out = dedupeMemory(memory);
  assert.equal(out.split("ship the beta on Friday").length - 1, 1);
  assert.ok(out.includes("Who signs off on pricing?"));
});

test("caps the total bullet count", () => {
  // Unrelated subjects, so the cap is what trims this — not the deduper.
  const subjects = [
    "Pricing moves to usage-based billing",
    "Mai owns the data migration",
    "Engineering capacity blocks the launch",
    "Legal needs two weeks for the DPA",
    "Support headcount rises by three",
    "The mobile app slips to Q4",
    "Churn concentrates in the SMB tier",
    "We drop the free trial entirely",
    "Nok presents at the board review",
    "Security audit lands in September",
    "Docs rewrite starts after the beta",
    "The Bangkok office lease renews",
    "Onboarding email sequence gets rebuilt",
    "Partner API stays private for now",
    "Warehouse migration finishes in August",
  ];
  const out = dedupeMemory(["## Key points", ...subjects.map((s) => `- ${s}`)].join("\n"));
  const bullets = out.split("\n").filter((l) => l.startsWith("- "));
  assert.ok(bullets.length <= MAX_TOTAL_BULLETS, `expected <= ${MAX_TOTAL_BULLETS}, got ${bullets.length}`);
  assert.ok(bullets.length >= 5, "the cap should trim, not empty the list");
});

test("keeps genuinely different points from the same meeting", () => {
  const memory = [
    "## Key points",
    "- We ship the beta on Friday",
    "- Pricing stays at 39 dollars",
    "- Engineering capacity is the constraint",
  ].join("\n");
  const bullets = dedupeMemory(memory).split("\n").filter((l) => l.startsWith("- "));
  assert.equal(bullets.length, 3);
});

test("preserves headings and non-bullet lead lines", () => {
  const memory = "## Intent\nsettle the Q3 pricing model\n\n## Key points\n- Pricing stays flat";
  const out = dedupeMemory(memory);
  assert.ok(out.includes("## Intent"));
  assert.ok(out.includes("settle the Q3 pricing model"));
  assert.ok(out.includes("## Key points"));
});

test("drops a heading whose bullets all collapsed away", () => {
  const memory = "## Key points\n- Ship Friday\n\n## Open threads\n- Ship Friday";
  const out = dedupeMemory(memory);
  assert.ok(!out.includes("## Open threads"));
});

test("thai restatements collapse too", () => {
  const memory = ["## Key points", "- ทีมจะปล่อยเบต้าวันศุกร์", "- เบต้าจะปล่อยวันศุกร์"].join("\n");
  const bullets = dedupeMemory(memory).split("\n").filter((l) => l.startsWith("- "));
  assert.equal(bullets.length, 1);
});

test("an update that says nothing new earns no write", () => {
  const previous = "## Key points\n- We ship the beta on Friday";
  assert.equal(shouldReplaceMemory(previous, previous), false);
  assert.equal(shouldReplaceMemory(previous, "  "), false);
});

test("a genuinely changed memory is written", () => {
  const previous = "## Key points\n- We ship the beta on Friday";
  const next = "## Key points\n- We ship the beta on Friday\n- Pricing drops to 29 dollars";
  assert.equal(shouldReplaceMemory(previous, next), true);
});

test("the first memory of a meeting is always written", () => {
  assert.equal(shouldReplaceMemory(null, "## Intent\nsettle pricing"), true);
  assert.equal(shouldReplaceMemory("", "## Intent\nsettle pricing"), true);
});
