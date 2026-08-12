import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSttText, collapseRepeatedRuns, isSttEcho } from "./sttText.ts";

test("collapses a looped Thai particle", () => {
  assert.equal(collapseRepeatedRuns("ครับครับครับครับ"), "ครับ");
});

test("collapses a looped English phrase", () => {
  assert.equal(
    collapseRepeatedRuns("the price is fine the price is fine the price is fine"),
    "the price is fine",
  );
});

test("collapses a looped single word", () => {
  assert.equal(collapseRepeatedRuns("ok ok ok ok"), "ok");
});

test("leaves ordinary speech alone", () => {
  const line = "we decided to ship on the 15th and Owen owns the pricing page";
  assert.equal(collapseRepeatedRuns(line), line);
});

test("a word said twice is emphasis, not a loop", () => {
  assert.equal(collapseRepeatedRuns("no no"), "no no");
});

test("collapses a loop that trails real content", () => {
  assert.equal(
    collapseRepeatedRuns("the launch is on the 15th ครับ ครับ ครับ ครับ"),
    "the launch is on the 15th ครับ",
  );
});

test("cleanSttText joins Thai and collapses in one pass", () => {
  assert.equal(cleanSttText("  ครับ ครับ ครับ  "), "ครับ");
});

test("cleanSttText still strips the spaces Chirp puts between Thai words", () => {
  assert.equal(cleanSttText("เรา ตัดสินใจ แล้ว"), "เราตัดสินใจแล้ว");
});

test("an identical line straight after the last one is an echo", () => {
  assert.equal(isSttEcho("ราคาเท่าไหร่", "ราคาเท่าไหร่"), true);
});

test("case and trailing punctuation do not hide an echo", () => {
  assert.equal(isSttEcho("We ship on the 15th.", "we ship on the 15th"), true);
});

test("a different sentence is not an echo", () => {
  assert.equal(isSttEcho("we ship on the 15th", "Owen owns the pricing page"), false);
});

test("nothing to compare against is not an echo", () => {
  assert.equal(isSttEcho(null, "we ship on the 15th"), false);
});
