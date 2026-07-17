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

// ── Document patch gateway (schema spec §7) ───────────────────────────────────
// After a meeting the AI proposes section-based patches to the PM document — the
// project's source of truth. The facilitator approves/edits/rejects each patch;
// approved patches commit the next document version (git-style history lives in
// document_versions). DTOs snake_case (AI JSON + DB); view types camelCase.

export type PmSectionKey =
  | "project_brief"
  | "current_status"
  | "current_project_direction"
  | "active_risks"
  | "key_constraints"
  | "context_needed_for_next_meeting";

export type PatchOperation = "replace_section" | "append_to_section" | "insert_section";

export type ReviewPriority = "LOW" | "MEDIUM" | "HIGH";

export interface DocumentPatchDTO {
  client_patch_id: string;
  operation: PatchOperation;
  section_key: PmSectionKey;
  section_title: string;
  new_content: string;
  reason?: string;
  confidence?: number;
  review_priority?: ReviewPriority;
  requires_facilitator_review?: boolean;
}

export interface RejectedSuggestion {
  title: string;
  reason_rejected: string;
}

/** The exact JSON shape the post-meeting document AI is required to emit. */
export interface DocumentPatchOutput {
  output_type: "document_patch_output";
  session_id: string;
  project_id: string;
  base_document_version: number;
  overall_change_summary: string;
  patches: DocumentPatchDTO[];
  rejected_suggestions?: RejectedSuggestion[];
}

// ── Decision extraction gateway (alignment checkpoint) ───────────────────────
// At wrap-up and session end the AI reads the whole transcript + rolling memory
// and returns the concrete decisions the room made — each tagged with whether it
// left the meeting specific enough to act on. This feeds the closing checkpoint,
// the honest summary, and the completeness metric. DTOs snake_case (AI JSON + DB).

// complete   — has what it needs (a due date; an owner too when owner-tracking on).
// incomplete — a real decision missing a due date (or owner when tracked): a gap.
// open       — deliberately parked/undecided; carries a revisit note, not a gap.
export type DecisionStatus = "complete" | "incomplete" | "open";

export interface DecisionDTO {
  // The decision restated concretely enough that two people could disagree with it.
  text: string;
  // ISO date (YYYY-MM-DD) or a short phrase the room actually said ("end of month").
  due_date?: string | null;
  owner?: string | null;
  // What is IN vs OUT — where false consensus hides ("phased rollout" = which phases).
  scope?: string | null;
  status: DecisionStatus;
  // For status "open": what/when reopens it, so a parked item can't vanish.
  revisit?: string | null;
  // Why the model marked it incomplete — shown to the facilitator on the card.
  missing?: string | null;
  confidence?: number;
}

/** The exact JSON shape the decision-extraction AI is required to emit. */
export interface DecisionExtractOutput {
  output_type: "decision_extract_output";
  session_id: string;
  decisions: DecisionDTO[];
}

// Persisted decision row (view type, camelCase). One row per decision per session.
export interface DecisionRecord {
  id: string;
  sessionId: string;
  meetingId: string;
  text: string;
  dueDate: string | null;
  owner: string | null;
  scope: string | null;
  status: DecisionStatus;
  revisit: string | null;
  missing: string | null;
  confidence: number | null;
  // "ai" when extracted, "facilitator" once the checkpoint edits/confirms it.
  source: "ai" | "facilitator";
  createdAt: string;
  updatedAt: string;
}

// PM document persisted state + version history (view types, camelCase).

export interface PmSection {
  title: string;
  content: string;
}

export interface PmDocumentState {
  sections: Record<PmSectionKey, PmSection>;
}

export interface PmDocument {
  id: string;
  projectId: string;
  orgId: string;
  state: PmDocumentState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PmDocumentVersion {
  id: string;
  version: number;
  sessionId: string | null;
  changeSummary: string;
  createdAt: string;
}

/** Canonical PM document section order + default titles (schema spec §7.3). */
export const PM_SECTIONS: { key: PmSectionKey; title: string }[] = [
  { key: "project_brief", title: "Project Brief" },
  { key: "current_status", title: "Current Status" },
  { key: "current_project_direction", title: "Current Project Direction" },
  { key: "active_risks", title: "Active Risks" },
  { key: "key_constraints", title: "Key Constraints" },
  { key: "context_needed_for_next_meeting", title: "Context for Next Meeting" },
];

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

/** A saved transcript row as broadcast over /ws (matches the transcripts table). */
export interface WsTranscriptRow {
  id: string;
  session_id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

/** Events the server pushes to a connected facilitator over /ws. */
export type WsServerEvent =
  | { type: "connected"; sessionId: string; role: Role }
  | { type: "suggestion:new"; card: SuggestionCard }
  | { type: "suggestion:answered"; sessionId: string; cardId: string; source: AnsweredSource }
  // Streaming STT (S-EXP): interim goes only to the socket that streams audio;
  // finals broadcast to the session so every open tab stays in sync.
  | { type: "stt:interim"; sessionId: string; text: string }
  | { type: "transcript:final"; sessionId: string; transcript: WsTranscriptRow }
  | { type: "stt:error"; sessionId: string; message: string };

/** Control messages a client may send over /ws. Binary frames on the same
 * socket carry raw PCM16LE mono audio for the active STT stream. */
export type WsClientEvent =
  | { type: "stt:start"; sampleRate: number; speaker?: string }
  | { type: "stt:stop" };

/** Placeholder until S1-T03-F provides real session IDs from the meeting lifecycle. */
export const DEMO_SESSION_ID = "session_demo";