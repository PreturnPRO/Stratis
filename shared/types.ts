// ─────────────────────────────────────────────────────────────────────────────
// SHARED TYPES — single source of truth, imported by frontend + backend
// Path alias: "@shared/types"
//
// Scope: foundation only (S1-T01-A … S1-T00-B). Feature types (sessions,
// transcript, AI blocks, dashboard, websocket events) are added in later tasks.
// ─────────────────────────────────────────────────────────────────────────────

// ── Roles & users (S1-T00-B) ─────────────────────────────────────────────────

export type Role = "facilitator" | "participant" | "admin";

export interface User {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  role?: Role; // defaults to "facilitator"
  orgName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ── Generic API envelope ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ── AI structured output (S1-T03-C) ───────────────────────────────────────────
// The AI must reply with JSON only — no markdown, no prose. Every reply is one
// envelope carrying an array of typed blocks. Block types mirror the `nodes`
// table (backend/src/db/schema.sql) so a block maps 1:1 to a node row later.

export type AIBlockType =
  | "TextBlock" // plain narrative / note
  | "DecisionNode" // a decision with options + status
  | "SummaryBlock" // condensed recap
  | "QuestionSuggestion"; // a question the AI surfaces to the room

// Free-form per-type metadata; serialized into nodes.metadata (JSON) later.
// Kept loose on purpose — the validator only checks the envelope + block core.
export interface AIBlockMetadata {
  status?: string; // e.g. VALIDATED | HIGH_EFFORT | FALSE | BLOCKED
  options?: string[]; // DecisionNode choices
  priority?: "low" | "med" | "high";
  [key: string]: unknown;
}

export interface AIBlock {
  type: AIBlockType;
  title: string;
  content: string;
  metadata?: AIBlockMetadata;
}

/** The exact JSON shape the model is required to emit. */
export interface AIStructuredResponse {
  blocks: AIBlock[];
}

// ── Live card output gateway (schema spec §6) ─────────────────────────────────
// The live meeting AI emits ONE `live_card_output` envelope per transcript
// chunk: it classifies the chunk, updates rolling memory, and may surface
// facilitator-only cards. DTOs are snake_case — they map 1:1 to the AI JSON and
// the SQLite columns. The frontend/internal view types below stay camelCase and
// are mapped at the boundary.

export type LiveCardType =
  | "QUESTION_SUGGESTION"
  | "DRIFT_ALERT"
  | "MISSING_DECISION"
  | "UNRESOLVED_ASSUMPTION";

export type LiveCardUrgency = "LOW" | "MEDIUM" | "HIGH";

export type ChunkSignal = "IMPORTANT" | "LOW_SIGNAL" | "IGNORE";

export type LiveCardState =
  | "NEW"
  | "AWARE"
  | "ANSWERED"
  | "DISMISSED"
  | "ESCALATED_TO_OPEN_QUESTION"
  | "LINKED_TO_DOCUMENT_PATCH";

export interface LiveCardEvidence {
  transcript_ref?: string;
  timestamp_start?: string;
  timestamp_end?: string;
  speaker?: string;
  quote?: string;
}

export interface LiveCardDTO {
  card_type: LiveCardType;
  title: string;
  brief_description: string;
  suggested_question?: string;
  urgency: LiveCardUrgency;
  related_agenda_item?: string | null;
  reason_now?: string;
  expected_resolution_signal?: string;
  confidence?: number;
  evidence?: LiveCardEvidence[];
  suggested_state?: LiveCardState;
}

/** The exact JSON shape the live meeting AI is required to emit. */
export interface LiveCardOutput {
  output_type: "live_card_output";
  session_id: string;
  chunk_id?: string;
  chunk_signal: ChunkSignal;
  rolling_memory_update?: string;
  cards: LiveCardDTO[];
}

// ── Realtime suggestion cards (S1-T03-E) ──────────────────────────────────────
// A live card becomes a card in the facilitator's suggestion stack. Cards are
// pushed over WebSocket to the facilitator's session ONLY — participants never
// receive suggestion events. A card is struck through when answered, either
// auto-detected from the transcript or marked manually.

export type AnsweredSource = "auto" | "manual";

export interface SuggestionCard {
  id: string;
  sessionId: string;
  question: string; // suggested_question (or title fallback)
  reason: string; // brief_description
  answered: boolean;
  answeredBy?: AnsweredSource;
  createdAt: string;
  // Phase 2 — live_card_output enrichment. Optional so pre-Phase-2 cards (and
  // the legacy block path) still validate.
  cardType?: LiveCardType;
  urgency?: LiveCardUrgency;
  confidence?: number;
}

/** Events the server pushes to a connected facilitator over /ws. */
export type WsServerEvent =
  | { type: "connected"; sessionId: string; role: Role }
  | { type: "suggestion:new"; card: SuggestionCard }
  | { type: "suggestion:answered"; sessionId: string; cardId: string; source: AnsweredSource };

/** Placeholder until S1-T03-F provides real session IDs from the meeting lifecycle. */
export const DEMO_SESSION_ID = "session_demo";