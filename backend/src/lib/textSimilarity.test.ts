import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeText,
  contentTokens,
  jaccardSimilarity,
  isNearDuplicate,
  DEFAULT_NEAR_DUP_THRESHOLD,
} from "./textSimilarity.ts";

// ── normalizeText ────────────────────────────────────────────────────────────
// Must exactly reproduce the two hand-rolled normalizers it replaces.

test("normalizeText lowercases, collapses whitespace, strips trailing punctuation", () => {
  assert.equal(normalizeText("  What  is  the   Budget? "), "what is the budget");
  assert.equal(normalizeText("Ship it!!!"), "ship it");
  assert.equal(normalizeText("Done."), "done");
});

test("normalizeText only strips TRAILING sentence punctuation, not internal", () => {
  assert.equal(normalizeText("Q3: budget?"), "q3: budget");
});

// ── contentTokens ────────────────────────────────────────────────────────────

test("contentTokens drops stopwords and interrogatives", () => {
  assert.deepEqual(contentTokens("What is the budget for Q3?").sort(), ["budget", "q3"]);
});

test("contentTokens keeps digit-bearing short tokens that discriminate topics", () => {
  assert.ok(contentTokens("the Q3 budget").includes("q3"));
  assert.ok(contentTokens("the Q4 budget").includes("q4"));
});

test("contentTokens drops single-letter noise (e.g. contraction remnants)", () => {
  // "what's" -> "what" (stopword) + "s" (1-char, no digit -> dropped)
  assert.deepEqual(contentTokens("What's the budget?"), ["budget"]);
});

test("contentTokens de-duplicates repeated words", () => {
  assert.deepEqual(contentTokens("budget budget budget"), ["budget"]);
});

test("contentTokens of an all-stopword string is empty", () => {
  assert.deepEqual(contentTokens("What is it?"), []);
});

// ── jaccardSimilarity ────────────────────────────────────────────────────────

test("jaccardSimilarity is 1 for token-identical rewordings", () => {
  assert.equal(jaccardSimilarity("What is the budget for Q3?", "What's our Q3 budget?"), 1);
});

test("jaccardSimilarity separates same-shape, different-topic questions", () => {
  // {budget,q3} vs {q4,budget}: intersection {budget}=1, union 3 -> 1/3
  assert.ok(Math.abs(jaccardSimilarity("the Q3 budget", "the Q4 budget") - 1 / 3) < 1e-9);
});

test("jaccardSimilarity is 0 when either side has no content tokens", () => {
  assert.equal(jaccardSimilarity("What is it?", "the budget"), 0);
  assert.equal(jaccardSimilarity("", "the budget"), 0);
});

// ── isNearDuplicate ──────────────────────────────────────────────────────────

test("isNearDuplicate catches exact typographic twins", () => {
  assert.equal(isNearDuplicate("Ship the beta?", "ship the BETA"), true);
});

test("isNearDuplicate catches stopword/aux/contraction rewordings (the core gap)", () => {
  assert.equal(
    isNearDuplicate("What is the budget for Q3?", "What's our Q3 budget?"),
    true,
  );
  assert.equal(
    isNearDuplicate("How do we handle onboarding?", "How should we handle onboarding?"),
    true,
  );
});

test("isNearDuplicate keeps genuinely distinct questions apart", () => {
  // Q3 vs Q4 budget — the false-merge trap that motivated keeping digit tokens.
  assert.equal(isNearDuplicate("What is the Q3 budget?", "What is the Q4 budget?"), false);
  // Same subject, different ask: owner vs timeline.
  assert.equal(
    isNearDuplicate("Who owns the mobile app?", "What is the timeline for the mobile app?"),
    false,
  );
  // Unrelated topics.
  assert.equal(isNearDuplicate("Who owns billing?", "Who owns onboarding?"), false);
});

test("isNearDuplicate never merges two distinct all-stopword strings", () => {
  // Both have empty token sets and differ after normalization -> not a dup.
  assert.equal(isNearDuplicate("What is it?", "How are they?"), false);
});

test("isNearDuplicate honors a custom threshold", () => {
  // {prioritize,mobile,app,web} vs {prioritize,mobile,web,first}: J = 3/5 = 0.6.
  const a = "Should we prioritize the mobile app or the web app?";
  const b = "Do we prioritize mobile or web first?";
  assert.equal(jaccardSimilarity(a, b), 0.6);
  assert.equal(isNearDuplicate(a, b, 0.6), true); // at the boundary (>=)
  assert.equal(isNearDuplicate(a, b, 0.7), false); // above -> distinct
});

test("DEFAULT_NEAR_DUP_THRESHOLD is the documented 0.6", () => {
  assert.equal(DEFAULT_NEAR_DUP_THRESHOLD, 0.6);
});

// ── Thai (space-less script) ────────────────────────────────────────────────
// Whitespace tokenizing yields ZERO tokens for Thai, so before n-gram support
// every Thai comparison silently fell through to exact-match only — the dedup
// did nothing in the product's primary market.

test("contentTokens yields tokens for Thai text (was empty)", () => {
  const tokens = contentTokens("งบประมาณไตรมาสสาม");
  assert.ok(tokens.length > 0, "Thai string must produce tokens");
  assert.ok(tokens.every((t) => t.startsWith("th:")), "Thai tokens are namespaced");
});

test("Thai near-duplicates are detected across rewording", () => {
  const a = "ใครรับผิดชอบงบประมาณไตรมาสสาม";
  const b = "งบประมาณไตรมาสสามใครรับผิดชอบ";
  assert.equal(isNearDuplicate(a, b), true);
});

test("Thai questions on different topics stay distinct", () => {
  const a = "เราจะจ้างพนักงานใหม่กี่คน";
  const b = "ราคาแพ็กเกจใหม่ควรเท่าไหร่";
  assert.equal(isNearDuplicate(a, b), false);
});

test("Thai particles alone never match", () => {
  assert.equal(isNearDuplicate("ครับ", "ค่ะ"), false);
});

test("mixed Thai+English keeps both token kinds", () => {
  const tokens = contentTokens("ทีม deploy ตอนนี้");
  assert.ok(tokens.includes("deploy"), "Latin word retained");
  assert.ok(tokens.some((t) => t.startsWith("th:")), "Thai n-grams retained");
});

test("English behavior is unchanged by the Thai path", () => {
  assert.equal(isNearDuplicate("What's our Q3 budget?", "What is the budget for Q3?"), true);
  assert.equal(isNearDuplicate("Q3 budget", "Q4 budget"), false);
});
