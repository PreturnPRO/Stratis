import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * The checkpoint may be extracted once per session at a time.
 *
 * `extractAndSaveDecisions` guards on "has this session got AI rows yet", then
 * spends up to 90 seconds in the model before inserting any. Two callers that
 * both read the empty state both insert: the wrap-up warm-up at T-15 and the
 * End button twenty seconds later, or the idle sweeper racing an HTTP end. The
 * facilitator sees every decision twice, each with a fresh id, so the review
 * state resets too.
 *
 * This test reads the source rather than exercising it, because reproducing the
 * race needs a database and a 90-second model call. It checks the structure
 * that makes the race impossible: a shared in-flight map, consulted before any
 * work starts.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, "decisions.ts"), "utf-8");

test("concurrent extractions share one in-flight promise", () => {
  assert.match(
    source,
    /const inFlight = new Map<string, Promise<DecisionRecord\[\]>>\(\)/,
    "decisions.ts should keep a per-session in-flight map",
  );

  const entry = source.slice(
    source.indexOf("export async function extractAndSaveDecisions"),
    source.indexOf("async function runExtraction"),
  );

  assert.match(entry, /inFlight\.get\(sessionId\)/, "the entry point must check the map first");
  assert.match(entry, /return running/, "a caller arriving second must await the first");
  assert.match(entry, /inFlight\.set\(sessionId, attempt\)/, "the attempt must be registered");
  assert.match(entry, /inFlight\.delete\(sessionId\)/, "and cleared when it settles");
});

test("the entry point does no work of its own", () => {
  const entry = source.slice(
    source.indexOf("export async function extractAndSaveDecisions"),
    source.indexOf("async function runExtraction"),
  );

  // If the guard sits after a model call or a write, it guards nothing.
  assert.doesNotMatch(entry, /extractDecisionsCall|INSERT INTO/);
});
