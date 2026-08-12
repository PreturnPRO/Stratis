// Explicit .ts extension: this module is covered by `node --test`, which type-
// strips rather than resolving like a bundler. tsconfig sets
// allowImportingTsExtensions, so tsc accepts it too.
import { isNearDuplicate } from "./textSimilarity.ts";

/**
 * Repair for the two ways streaming STT produces text nobody said.
 *
 * 1. The model loops. Chirp emits a phrase over and over when it is fed
 *    silence, room noise, or a speaker trailing off — "ครับ ครับ ครับ ครับ"
 *    inside one final result. That is a property of the recogniser, not of
 *    anything the pipeline can prevent upstream, so it is cleaned on the way in.
 *
 * 2. The same final arrives twice. Two browser tabs on one session each hold a
 *    socket and each opens its own recogniser over the same room audio; a
 *    reconnect can leave the old socket alive until the 30s heartbeat reaps it.
 *    Both write the same sentence to the same transcript.
 *
 * Both land as "the transcript repeats itself", and both are caught here, at
 * the single boundary every streaming final crosses.
 */

/** Longest phrase treated as a possible loop unit. */
const MAX_UNIT = 60;

/**
 * A unit, then two or more repeats of it.
 *
 * The separator sits in `\s*` between repeats rather than inside the unit,
 * because the last repeat of a loop has nothing after it — "ok ok ok ok" is
 * "ok " twice and then a bare "ok", and a pattern that demanded the trailing
 * space stopped one repeat short and left "ok ok" behind.
 */
const LOOP_PATTERN = /(\S.{0,58}?)(?:\s*\1){2,}/g;

/**
 * Collapses an immediately-repeated run down to one occurrence.
 *
 * Three repetitions, not two: "no no" and "มากๆ มากๆ" are things people say,
 * and a rule that flattened them would be editing speech rather than repairing
 * it. Runs the pass to a fixed point so a loop nested inside a longer loop
 * settles, with a cap so a pathological input cannot spin.
 */
export function collapseRepeatedRuns(raw: string): string {
  // Normalised first so the pattern sees one shape of whitespace.
  let text = raw.replace(/\s+/g, " ").trim();

  for (let pass = 0; pass < 4; pass += 1) {
    const next = text.replace(LOOP_PATTERN, (match, unit: string) => {
      // A single character is a stutter or a vowel held too long, not a phrase.
      if (unit.trim().length < 2) return match;
      return unit;
    });
    if (next === text) break;
    text = next;
  }

  return text.trim();
}

/**
 * Chirp puts spaces between Thai words; Thai does not use them, and leaving
 * them in makes every downstream comparison treat one sentence as many.
 */
export function cleanSttText(raw: string): string {
  const collapsed = collapseRepeatedRuns(raw);
  return collapsed.replace(/([฀-๿])\s+(?=[฀-๿])/g, "$1").trim();
}

/**
 * True when this final says what the previous line already said. Compared
 * against the immediately preceding line only: a meeting genuinely returns to
 * the same sentence later, and suppressing that would be losing the record.
 */
export function isSttEcho(previous: string | null | undefined, next: string): boolean {
  if (!previous) return false;
  return isNearDuplicate(previous, next);
}

export { MAX_UNIT };
