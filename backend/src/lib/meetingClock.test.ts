import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * The clock on screen and the minutes deducted are the same subtraction.
 *
 * They were not. The biller has always counted
 * `COALESCE(ended_at, NOW()) - started_at` — server-side, running while the
 * facilitator is disconnected — while the meeting screen counted from whenever
 * the tab last loaded, falling back to `Date.now()` when `started_at` was null.
 * So the timer restarted on every refresh and disagreed with the bill, and
 * nothing failed: both numbers looked plausible on their own.
 *
 * Neither side can be exercised here — one is SQL against a database this
 * environment has no copy of, the other is React. What can be checked is that
 * both still derive from the session's own start, which is the property that
 * broke.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

test("the biller measures from started_at to ended_at, or to now while live", () => {
  const entitlements = readFileSync(resolve(repoRoot, "backend/src/lib/entitlements.ts"), "utf-8");

  assert.match(
    entitlements.replace(/\s+/g, " "),
    /COALESCE\(s\.ended_at, NOW\(\)\) - s\.started_at/,
    "recorded minutes must run from the session's start to its end, or to now while it is live",
  );
});

test("the meeting screen counts from the server's start, never from page load", () => {
  const meeting = readFileSync(resolve(repoRoot, "src/pages/Meeting.tsx"), "utf-8");

  // The elapsed figure is startMs subtracted from a server-corrected now.
  assert.match(
    meeting.replace(/\s+/g, " "),
    /nowMs \+ recovery\.serverSkewMs - startMs/,
    "elapsed must be measured against the server's clock, not the browser's",
  );

  // startMs comes from the session row and stays null when it has not started.
  const startBlock = meeting.slice(meeting.indexOf("const serverStart"));
  assert.match(
    startBlock.slice(0, 400).replace(/\s+/g, " "),
    /setStartMs\(Number\.isFinite\(serverStart\) \? serverStart : null\)/,
    "falling back to Date.now() is what made the timer restart on every refresh",
  );
});

test("recovery hands the client the server's clock", () => {
  const session = readFileSync(resolve(repoRoot, "backend/src/routes/session.ts"), "utf-8");
  const recover = session.slice(session.indexOf('sessionRouter.get("/recover"'));

  assert.match(
    recover.slice(0, 3000),
    /serverNow/,
    "without the server's own timestamp the client cannot correct a wrong device clock",
  );
});
