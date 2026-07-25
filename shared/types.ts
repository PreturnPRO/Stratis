

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
  role?: Role;
  orgName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type AIBlockType =
  | "TextBlock"
  | "DecisionNode"
  | "SummaryBlock"
  | "QuestionSuggestion";

export interface AIBlockMetadata {
  status?: string;
  options?: string[];
  priority?: "low" | "med" | "high";
  [key: string]: unknown;
}

export interface AIBlock {
  type: AIBlockType;
  title: string;
  content: string;
  metadata?: AIBlockMetadata;
}

export interface AIStructuredResponse {
  blocks: AIBlock[];
}

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

export interface LiveCardOutput {
  output_type: "live_card_output";
  session_id: string;
  chunk_id?: string;
  chunk_signal: ChunkSignal;
  rolling_memory_update?: string;
  cards: LiveCardDTO[];
}

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

export interface DocumentPatchOutput {
  output_type: "document_patch_output";
  session_id: string;
  project_id: string;
  base_document_version: number;
  overall_change_summary: string;
  patches: DocumentPatchDTO[];
  rejected_suggestions?: RejectedSuggestion[];
}

export type DecisionStatus = "complete" | "incomplete" | "open";

export interface DecisionDTO {
  text: string;
  due_date?: string | null;
  owner?: string | null;
  scope?: string | null;
  status: DecisionStatus;
  revisit?: string | null;
  missing?: string | null;
  confidence?: number;
}

export interface DecisionExtractOutput {
  output_type: "decision_extract_output";
  session_id: string;
  decisions: DecisionDTO[];
}

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
  source: "ai" | "facilitator";
  dismissed: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export const PM_SECTIONS: { key: PmSectionKey; title: string }[] = [
  { key: "project_brief", title: "Project Brief" },
  { key: "current_status", title: "Current Status" },
  { key: "current_project_direction", title: "Current Project Direction" },
  { key: "active_risks", title: "Active Risks" },
  { key: "key_constraints", title: "Key Constraints" },
  { key: "context_needed_for_next_meeting", title: "Context for Next Meeting" },
];

export type AnsweredSource = "auto" | "manual";

export interface SuggestionCard {
  id: string;
  sessionId: string;
  question: string;
  reason: string;
  answered: boolean;
  answeredBy?: AnsweredSource;
  createdAt: string;
  cardType?: LiveCardType;
  urgency?: LiveCardUrgency;
  confidence?: number;
}

export interface WsTranscriptRow {
  id: string;
  session_id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export type WsServerEvent =
  | { type: "connected"; sessionId: string; role: Role }
  | { type: "suggestion:new"; card: SuggestionCard }
  | { type: "suggestion:answered"; sessionId: string; cardId: string; source: AnsweredSource }
  | { type: "stt:interim"; sessionId: string; text: string }
  | { type: "transcript:final"; sessionId: string; transcript: WsTranscriptRow }
  | { type: "stt:error"; sessionId: string; message: string }
  | { type: "notes:update"; sessionId: string; text: string };

export type WsClientEvent =
  | { type: "stt:start"; sampleRate: number; speaker?: string }
  | { type: "stt:flush" }
  | { type: "stt:stop" };

export const DEMO_SESSION_ID = "session_demo";
