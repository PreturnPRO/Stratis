// Tests for the AI structured-output parse boundary (ai-service/src/schema.ts).
//
// These four parsers are the ONLY thing standing between raw, nondeterministic
// model text and the DB / facilitator UI — there is no zod/ajv, the check is
// hand-written and total (see schema.ts header). Until now it had zero test
// coverage. This suite locks in both the strict validation AND the new
// prose/fence recovery in extractJsonObject.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractJsonObject,
  parseStructured,
  parseLiveCard,
  parseDocumentPatch,
  parseDecisionExtract,
} from "./schema.ts";

// ── Valid payloads for each contract ─────────────────────────────────────────
const liveOk = JSON.stringify({
  output_type: "live_card_output",
  chunk_signal: "IMPORTANT",
  rolling_memory_update: "## Intent\nship the beta",
  cards: [
    {
      card_type: "QUESTION_SUGGESTION",
      title: "Clarify v1 scope",
      brief_description: "scope of the first release is unstated",
      suggested_question: "What is in v1 exactly?",
      urgency: "MEDIUM",
      confidence: 0.8,
    },
  ],
});

const decisionOk = JSON.stringify({
  output_type: "decision_extract_output",
  decisions: [
    {
      text: "redesign the consent screen this sprint",
      due_date: null,
      owner: "Nick",
      scope: null,
      status: "incomplete",
      revisit: null,
      missing: "no deadline",
      confidence: 0.7,
    },
  ],
});

const structuredOk = JSON.stringify({
  blocks: [{ type: "TextBlock", title: "Overview", content: "We discussed the roadmap." }],
});

const patchOk = JSON.stringify({
  overall_change_summary: "status refreshed",
  patches: [
    {
      client_patch_id: "patch_1",
      operation: "replace_section",
      section_key: "current_status",
      section_title: "Status",
      new_content: "On track for the beta.",
      reason: "per the meeting",
      confidence: 0.9,
      review_priority: "LOW",
    },
  ],
  rejected_suggestions: [],
});

// ── extractJsonObject (the new recovery helper) ──────────────────────────────
test("extractJsonObject: passes a bare object through unchanged", () => {
  assert.equal(extractJsonObject('{"a":1}'), '{"a":1}');
});

test("extractJsonObject: strips ```json fences", () => {
  assert.equal(extractJsonObject('```json\n{"a":1}\n```'), '{"a":1}');
});

test("extractJsonObject: recovers an object wrapped in prose", () => {
  assert.equal(
    extractJsonObject('Sure, here is the output: {"a":1} hope this helps'),
    '{"a":1}',
  );
});

test("extractJsonObject: trims trailing prose after a valid object", () => {
  assert.equal(extractJsonObject('{"a":1}\n\nLet me know if you need changes.'), '{"a":1}');
});

test("extractJsonObject: ignores braces inside string values", () => {
  const s = '{"note":"use the {placeholder} token }}"}';
  assert.equal(extractJsonObject(`prefix ${s} suffix`), s);
});

test("extractJsonObject: ignores an escaped quote inside a string", () => {
  const s = '{"q":"say \\"hi\\" now"}';
  assert.equal(extractJsonObject(s), s);
});

test("extractJsonObject: leaves a top-level array untouched", () => {
  assert.equal(extractJsonObject('[{"a":1}]'), '[{"a":1}]');
});

test("extractJsonObject: returns cleaned text when there is no object", () => {
  assert.equal(extractJsonObject("I cannot help with that."), "I cannot help with that.");
});

test("extractJsonObject: empty input stays empty", () => {
  assert.equal(extractJsonObject("   "), "");
});

test("extractJsonObject: returns from the first brace when unbalanced/truncated", () => {
  assert.equal(extractJsonObject('junk {"a":1'), '{"a":1');
});

// ── parseLiveCard ────────────────────────────────────────────────────────────
test("parseLiveCard: accepts a well-formed live_card_output", () => {
  const r = parseLiveCard(liveOk);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.chunk_signal, "IMPORTANT");
    assert.equal(r.data.cards.length, 1);
    assert.equal(r.data.cards[0].suggested_question, "What is in v1 exactly?");
  }
});

test("parseLiveCard: recovers a prose-wrapped response (was previously discarded)", () => {
  const wrapped = `Here is the card you asked for:\n${liveOk}\nAnything else?`;
  const r = parseLiveCard(wrapped);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.cards.length, 1);
});

test("parseLiveCard: recovers a fenced response", () => {
  const r = parseLiveCard("```json\n" + liveOk + "\n```");
  assert.equal(r.ok, true);
});

test("parseLiveCard: preserves braces inside rolling_memory_update", () => {
  const payload = JSON.stringify({
    chunk_signal: "IMPORTANT",
    rolling_memory_update: "## Key points\n- token is {value}",
    cards: [],
  });
  const r = parseLiveCard(`noise ${payload} trailing`);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.rolling_memory_update, "## Key points\n- token is {value}");
});

test("parseLiveCard: empty cards array is valid (stay-silent)", () => {
  const r = parseLiveCard('{"chunk_signal":"IGNORE","cards":[]}');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.cards.length, 0);
});

test("parseLiveCard: rejects an invalid chunk_signal", () => {
  const r = parseLiveCard('{"chunk_signal":"MAYBE","cards":[]}');
  assert.equal(r.ok, false);
});

test("parseLiveCard: rejects a card with an out-of-range confidence", () => {
  const bad = JSON.stringify({
    chunk_signal: "IMPORTANT",
    cards: [
      {
        card_type: "DRIFT_ALERT",
        title: "off topic",
        brief_description: "drifted",
        urgency: "LOW",
        confidence: 1.5,
      },
    ],
  });
  const r = parseLiveCard(bad);
  assert.equal(r.ok, false);
});

test("parseLiveCard: prose with no JSON still fails as invalid JSON", () => {
  const r = parseLiveCard("I can't produce that right now.");
  assert.equal(r.ok, false);
});

test("parseLiveCard: truncated JSON fails cleanly", () => {
  const r = parseLiveCard('{"chunk_signal":"IGNORE","cards":[');
  assert.equal(r.ok, false);
});

// ── parseDecisionExtract (the hero alignment-checkpoint path) ─────────────────
test("parseDecisionExtract: accepts a well-formed decision_extract_output", () => {
  const r = parseDecisionExtract(decisionOk);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.decisions.length, 1);
    assert.equal(r.data.decisions[0].status, "incomplete");
  }
});

test("parseDecisionExtract: recovers a prose-wrapped extraction", () => {
  const r = parseDecisionExtract(`Here are the decisions:\n${decisionOk}`);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.decisions.length, 1);
});

test("parseDecisionExtract: empty decisions array is valid (settled nothing)", () => {
  const r = parseDecisionExtract('{"decisions":[]}');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.decisions.length, 0);
});

test("parseDecisionExtract: rejects an invalid status", () => {
  const r = parseDecisionExtract(
    '{"decisions":[{"text":"do the thing","status":"done"}]}',
  );
  assert.equal(r.ok, false);
});

test("parseDecisionExtract: rejects a decision with empty text", () => {
  const r = parseDecisionExtract(
    '{"decisions":[{"text":"   ","status":"open"}]}',
  );
  assert.equal(r.ok, false);
});

// ── parseStructured & parseDocumentPatch (summary + PM-document paths) ────────
test("parseStructured: accepts valid blocks and recovers from prose", () => {
  assert.equal(parseStructured(structuredOk).ok, true);
  assert.equal(parseStructured(`Summary:\n${structuredOk}\nDone.`).ok, true);
});

test("parseStructured: rejects an empty blocks array", () => {
  assert.equal(parseStructured('{"blocks":[]}').ok, false);
});

test("parseStructured: leaves a bare array as a top-level-object error, not a dug-out block", () => {
  const arr = '[{"type":"TextBlock","title":"t","content":"c"}]';
  const r = parseStructured(arr);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /object/);
});

test("parseDocumentPatch: accepts valid patches and recovers from prose", () => {
  assert.equal(parseDocumentPatch(patchOk).ok, true);
  assert.equal(parseDocumentPatch(`Patches:\n${patchOk}`).ok, true);
});

test("parseDocumentPatch: rejects an invalid section_key", () => {
  const bad = JSON.stringify({
    patches: [
      {
        operation: "replace_section",
        section_key: "not_a_section",
        new_content: "x",
      },
    ],
  });
  assert.equal(parseDocumentPatch(bad).ok, false);
});
