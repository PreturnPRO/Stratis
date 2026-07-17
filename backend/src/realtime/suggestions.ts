// Suggestion store (S1-T03-E). Holds the open/answered suggestion cards per
// session in memory — the source of truth for what the facilitator's stack
// shows during a live meeting. A QuestionSuggestion block from the AI becomes
// a card here; auto-detect or a manual tap marks it answered.
//
// In-memory by design: a meeting's stack is ephemeral. Persistence to the
// `nodes`/`notifications` tables is a later task — this owns live state only.
import type { AIBlock, AnsweredSource, LiveCardDTO, SuggestionCard } from "@shared/types";
import { newId, now } from "../lib/ids";

// sessionId -> (cardId -> card)
const bySession = new Map<string, Map<string, SuggestionCard>>();

// Ceiling on unanswered cards per session — once reached, new live_card
// suggestions are dropped rather than piling into the stack. Kept close to
// the UI's VISIBLE_ACTIVE_CAP (SuggestionCardStack.tsx) so the "+N more
// open" queue stays short instead of growing unbounded.
const MAX_OPEN_CARDS_PER_SESSION = 4;

// Below this confidence, a suggested card is too speculative to surface.
// Only applies when the model actually supplied a confidence — cards that
// omit it are trusted as-is.
const MIN_CARD_CONFIDENCE = 0.5;

function normalizeQuestion(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/g, "");
}

function sessionMap(sessionId: string): Map<string, SuggestionCard> {
  let m = bySession.get(sessionId);
  if (!m) {
    m = new Map();
    bySession.set(sessionId, m);
  }
  return m;
}

/** Turn the QuestionSuggestion blocks of an AI response into stored cards. */
export function createFromBlocks(sessionId: string, blocks: AIBlock[]): SuggestionCard[] {
  const m = sessionMap(sessionId);
  const created: SuggestionCard[] = [];
  for (const b of blocks) {
    if (b.type !== "QuestionSuggestion") continue;
    const card: SuggestionCard = {
      id: newId("sug"),
      sessionId,
      question: b.title,
      reason: b.content,
      answered: false,
      createdAt: now(),
    };
    m.set(card.id, card);
    created.push(card);
  }
  return created;
}

/** Turn a live_card_output's cards (schema spec §6) into stored cards.
 *  Filters out low-confidence, duplicate, and over-cap suggestions so the
 *  stack can't be flooded even if the model over-suggests. */
export function createFromLiveCards(sessionId: string, cards: LiveCardDTO[]): SuggestionCard[] {
  const m = sessionMap(sessionId);
  const created: SuggestionCard[] = [];

  let openCount = openCards(sessionId).length;
  // Dedup against EVERY card this session — including answered ones. A struck
  // card means the room already covered it; re-suggesting it reads as broken.
  const seenQuestions = new Set(
    allCards(sessionId).map((c) => normalizeQuestion(c.question))
  );

  for (const c of cards) {
    if (c.confidence !== undefined && c.confidence < MIN_CARD_CONFIDENCE) continue;
    if (openCount >= MAX_OPEN_CARDS_PER_SESSION) continue;

    const question = c.suggested_question?.trim() || c.title;
    const normalized = normalizeQuestion(question);
    if (seenQuestions.has(normalized)) continue;

    const card: SuggestionCard = {
      id: newId("sug"),
      sessionId,
      question,
      reason: c.brief_description,
      answered: false,
      createdAt: now(),
      cardType: c.card_type,
      urgency: c.urgency,
      confidence: c.confidence,
    };
    m.set(card.id, card);
    created.push(card);
    seenQuestions.add(normalized);
    openCount++;
  }
  return created;
}

/** Cards still awaiting an answer — what auto-detect scans against. */
export function openCards(sessionId: string): SuggestionCard[] {
  return [...sessionMap(sessionId).values()].filter((c) => !c.answered);
}

/** All cards for a session, newest first (stack order). */
export function allCards(sessionId: string): SuggestionCard[] {
  return [...sessionMap(sessionId).values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * Mark a card answered. Returns the updated card, or null if unknown / already
 * answered (so callers don't emit a duplicate strikethrough event).
 */
export function markAnswered(
  sessionId: string,
  cardId: string,
  source: AnsweredSource
): SuggestionCard | null {
  const card = sessionMap(sessionId).get(cardId);
  if (!card || card.answered) return null;
  card.answered = true;
  card.answeredBy = source;
  return card;
}

/** Test/teardown helper — drop a session's cards. */
export function clearSession(sessionId: string): void {
  bySession.delete(sessionId);
}
