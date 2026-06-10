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
