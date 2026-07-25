import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LANGUAGE_MODE,
  isMeetingLanguageMode,
  langCodesFor,
  resolveLangCodes,
} from "./sttLanguage.ts";

// The whole point of the fix: an all-English meeting recognised against a
// Thai-primary language list gets Thai words spliced into its transcript, which
// then poisons the rolling memory and the summary.
test("English mode excludes Thai", () => {
  const codes = langCodesFor("en");
  assert.deepEqual(codes, ["en-US"]);
  assert.ok(!codes.includes("th-TH"));
});

test("Thai mode excludes English", () => {
  assert.deepEqual(langCodesFor("th"), ["th-TH"]);
});

test("mixed mode lists both, Thai primary", () => {
  assert.deepEqual(langCodesFor("mixed"), ["th-TH", "en-US"]);
});

test("default mode is mixed", () => {
  assert.equal(DEFAULT_LANGUAGE_MODE, "mixed");
  assert.deepEqual(langCodesFor(DEFAULT_LANGUAGE_MODE), ["th-TH", "en-US"]);
});

test("isMeetingLanguageMode accepts only known modes", () => {
  assert.equal(isMeetingLanguageMode("en"), true);
  assert.equal(isMeetingLanguageMode("th"), true);
  assert.equal(isMeetingLanguageMode("mixed"), true);
  assert.equal(isMeetingLanguageMode("EN"), false);
  assert.equal(isMeetingLanguageMode("english"), false);
  assert.equal(isMeetingLanguageMode(undefined), false);
  assert.equal(isMeetingLanguageMode(null), false);
  assert.equal(isMeetingLanguageMode(42), false);
});

// Values arrive from a query param / WS message / DB column, so junk must fall
// back to the configured default rather than producing an empty language list.
test("resolveLangCodes falls back on junk input", () => {
  const fallback = ["th-TH", "en-US"];
  assert.deepEqual(resolveLangCodes("en", fallback), ["en-US"]);
  assert.deepEqual(resolveLangCodes("nonsense", fallback), fallback);
  assert.deepEqual(resolveLangCodes(undefined, fallback), fallback);
  assert.deepEqual(resolveLangCodes({}, fallback), fallback);
});
