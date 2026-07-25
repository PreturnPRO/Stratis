// Lightweight text-similarity helpers for near-duplicate detection.
//
// Two dedup sites need the same judgment — "are these two short strings the
// same idea, worded differently?": the live-card stack (realtime/suggestions.ts)
// and decision extraction (lib/decisions.ts). Both previously used a hand-rolled
// exact-string normalizer (case + whitespace + trailing punctuation), which only
// catches typographic twins. The facilitator's real complaint is the OTHER kind:
// "What's our Q3 budget?" stacking right under "What is the budget for Q3?" —
// different strings, same question.
//
// Self-contained on purpose (no imports): the backend test runner
// (node --experimental-strip-types --test) can only load modules with no
// extensionless / path-aliased dependencies, so the testable logic lives here
// and the stateful callers stay thin. Same split the repo already uses for
// sttStreamPolicy.ts (tested) vs sttStream.ts (not).

// Function words and interrogatives carry no topic signal — "what/how/should/
// the/for" are noise when deciding whether two questions ask the same thing.
const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "is", "are",
  "was", "were", "be", "been", "being", "we", "do", "does", "did", "should",
  "would", "could", "can", "will", "shall", "what", "why", "how", "when", "who",
  "which", "whom", "whose", "this", "that", "it", "have", "has", "had", "with",
  "our", "you", "your", "i", "they", "them", "about", "if", "so", "but", "as",
  "at", "from", "by", "into", "than", "then", "us", "there", "their",
]);

/**
 * Case / whitespace / trailing-punctuation normalizer. Preserves the exact
 * behavior of the two hand-rolled normalizers this replaces (suggestions.ts
 * `normalizeQuestion`, decisions.ts `normalizeDecisionText`) so existing
 * exact-match dedup keeps working unchanged.
 */
export function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/g, "");
}

/**
 * Topic-bearing tokens of a string: lowercased, punctuation stripped, stopwords
 * removed, de-duplicated. Digit-bearing short tokens ("q3", "q4", "v2", "k8")
 * are kept on purpose — they are exactly what distinguishes otherwise-identical
 * questions ("the Q3 budget" vs "the Q4 budget"); 1-char noise is dropped.
 */
export function contentTokens(text: string): string[] {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)) {
    if (!raw) continue;
    if (STOPWORDS.has(raw)) continue;
    // Keep tokens of length >= 2, or any token containing a digit.
    if (raw.length < 2 && !/[0-9]/.test(raw)) continue;
    out.add(raw);
  }
  return [...out];
}

/**
 * Jaccard overlap of the two content-token SETS: |A ∩ B| / |A ∪ B|. Returns 0
 * when either side has no content tokens (all stopwords) — an empty set is
 * "no topic", which must never be treated as matching another string.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const A = new Set(contentTokens(a));
  const B = new Set(contentTokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return inter / union;
}

// Content-token overlap at/above which two strings are treated as the same
// idea. Chosen conservatively: for a live facilitator, suppressing a genuinely
// distinct question is a worse failure than letting a near-twin through, so the
// bar leans toward keeping cards rather than merging them. Empirically this
// merges stopword/aux-verb/contraction rewordings ("What's our Q3 budget?" ≈
// "What is the budget for Q3?") while keeping topic-different questions apart
// ("Q3 budget" vs "Q4 budget"; "who owns X" vs "what's the timeline for X").
export const DEFAULT_NEAR_DUP_THRESHOLD = 0.6;

/**
 * True when two strings express the same idea worded differently: an exact
 * match after normalization (typographic twins), OR content-token Jaccard
 * at/above `threshold`.
 */
export function isNearDuplicate(
  a: string,
  b: string,
  threshold: number = DEFAULT_NEAR_DUP_THRESHOLD,
): boolean {
  if (normalizeText(a) === normalizeText(b)) return true;
  return jaccardSimilarity(a, b) >= threshold;
}
