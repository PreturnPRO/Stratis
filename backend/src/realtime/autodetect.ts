// Auto-detect (S1-T03-E). Monitors transcript text and decides which open
// suggestion cards have now been raised AND answered in the conversation, so
// the server can strike them through automatically.
//
// No ML here — a lightweight, deterministic keyword-overlap heuristic that is
// cheap to run on every transcript chunk and easy to unit-test. The richer
// NLP model is a Sprint 3 concern (S3-T12-E drift detection shares this seam).
import type { SuggestionCard } from "@shared/types";

const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "is", "are",
  "we", "do", "does", "did", "should", "would", "could", "can", "what", "why",
  "how", "when", "who", "this", "that", "it", "be", "have", "has", "with", "our",
  "you", "your", "i", "they", "them", "about", "if", "so", "but", "as", "at",
]);

/** Content words of a string, lowercased, stopwords removed. */
function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Has this question been answered in the transcript? True when:
 *   1. enough of the question's keywords appear (the topic was raised), AND
 *   2. the transcript shows an answer-shaped reply after that point.
 * Threshold scales with question length so short questions need full overlap.
 */
export function isAnswered(question: string, transcript: string): boolean {
  const qWords = keywords(question);
  if (qWords.length === 0) return false;

  const tWords = keywords(transcript);
  const tSet = new Set(tWords);

  const overlap = qWords.filter((w) => tSet.has(w)).length;
  const ratio = overlap / qWords.length;

  // Topic must clearly appear: 60% of content words present (min 2).
  const raised = overlap >= Math.max(2, Math.ceil(qWords.length * 0.6));
  if (!raised) return false;

  // Answer-shaped signal: a decision/answer cue word in the transcript.
  const ANSWER_CUES = /\b(decided|agreed|yes|no|because|we'?ll|let'?s|confirmed|answer|resolved|going with|will use)\b/i;
  return ratio >= 0.6 && ANSWER_CUES.test(transcript);
}

/** Return the ids of open cards the transcript now answers. */
export function detectAnswered(transcript: string, open: SuggestionCard[]): string[] {
  return open.filter((c) => isAnswered(c.question, transcript)).map((c) => c.id);
}
