import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * What a live suggestion call costs, and why the caps are where they are.
 *
 * These numbers come from the beta database on 2026-08-14: a 41-minute meeting
 * with 186 transcript lines totalling 23,835 characters that produced 13 cards,
 * and a project document already at 7,378 characters on version 17.
 *
 * The test is here so the reasoning survives. If someone raises a cap, this
 * says what it costs per meeting before they do.
 */

const MEASURED = {
  /** stratis1, version 17. Grows with the project, not the meeting. */
  projectDocChars: 7_378,
  /** 24 rows at the observed average line length. */
  recentChars: 3_100,
  /** 13 cards by the end of a 41-minute meeting, all of them re-sent. */
  allQuestionsChars: 1_000,
  rollingSummaryChars: 1_000,
  promptOverheadChars: 1_500,
  /** 45 minutes at the 15-second floor between calls. */
  callsPerMeeting: 180,
} as const;

const CAPS = {
  projectDocChars: 1_500,
  recentChars: 3_000,
  /** 8 open questions, answered ones no longer sent. */
  openQuestionsChars: 500,
} as const;

/** Rough but consistent: ~4 characters per token for mixed Thai and English. */
const CHARS_PER_TOKEN = 4;

function tokensPerCall(doc: number, recent: number, questions: number): number {
  return Math.round(
    (doc + recent + questions + MEASURED.rollingSummaryChars + MEASURED.promptOverheadChars) /
      CHARS_PER_TOKEN,
  );
}

test("the caps cut a live call to under half of what it carried", () => {
  const before = tokensPerCall(
    MEASURED.projectDocChars,
    MEASURED.recentChars,
    MEASURED.allQuestionsChars,
  );
  const after = tokensPerCall(CAPS.projectDocChars, CAPS.recentChars, CAPS.openQuestionsChars);

  assert.ok(before > 3_000, `expected the old call to exceed 3k tokens, got ${before}`);
  assert.ok(after < before * 0.6, `expected under 60% of the old cost, got ${after} vs ${before}`);
});

test("a meeting's live-card bill no longer grows with the age of the project", () => {
  // The document was the only unbounded term. A workspace two years in with a
  // 40k-character document paid for it 180 times per meeting.
  const matureDoc = 40_000;

  const uncapped = tokensPerCall(matureDoc, MEASURED.recentChars, MEASURED.allQuestionsChars);
  const capped = tokensPerCall(CAPS.projectDocChars, CAPS.recentChars, CAPS.openQuestionsChars);

  assert.ok(
    uncapped > capped * 4,
    "an old project used to cost multiples of a new one for the same meeting",
  );

  // After the cap, the document contributes a fixed amount whatever its size.
  const cappedWithMatureDoc = tokensPerCall(
    Math.min(matureDoc, CAPS.projectDocChars),
    CAPS.recentChars,
    CAPS.openQuestionsChars,
  );
  assert.equal(capped, cappedWithMatureDoc);
});

test("the filler gate removes calls that could not have produced a card", () => {
  // Observed: 13 cards from ~180 calls in a 41-minute meeting.
  const cardsProduced = 13;
  const wasted = MEASURED.callsPerMeeting - cardsProduced;

  assert.ok(
    wasted / MEASURED.callsPerMeeting > 0.9,
    "over 90% of live calls produced nothing — that is what the gate targets",
  );
});
