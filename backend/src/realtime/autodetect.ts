import type { SuggestionCard } from "@shared/types";

const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "is", "are",
  "we", "do", "does", "did", "should", "would", "could", "can", "what", "why",
  "how", "when", "who", "this", "that", "it", "be", "have", "has", "with", "our",
  "you", "your", "i", "they", "them", "about", "if", "so", "but", "as", "at",
]);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function isAnswered(question: string, transcript: string): boolean {
  const qWords = keywords(question);
  if (qWords.length === 0) return false;

  const tWords = keywords(transcript);
  const tSet = new Set(tWords);

  const overlap = qWords.filter((w) => tSet.has(w)).length;
  const ratio = overlap / qWords.length;

  const raised = overlap >= Math.max(2, Math.ceil(qWords.length * 0.6));
  if (!raised) return false;

  const ANSWER_CUES = /\b(decided|agreed|yes|no|because|we'?ll|let'?s|confirmed|answer|resolved|going with|will use)\b/i;
  return ratio >= 0.6 && ANSWER_CUES.test(transcript);
}

export function detectAnswered(transcript: string, open: SuggestionCard[]): string[] {
  return open.filter((c) => isAnswered(c.question, transcript)).map((c) => c.id);
}
