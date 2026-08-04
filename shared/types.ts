

export type Role = "facilitator" | "participant" | "admin";

export type AccountStatus = "active" | "suspended" | "revoked";

export type AuthProvider = "password" | "google";

export interface User {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  status?: AccountStatus;
  authProvider?: AuthProvider;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  timezone?: string | null;
  locale?: string;
  settings?: UserSettings;
  lastActiveAt?: string | null;
}

/**
 * Per-user preferences. Stored as one JSONB blob rather than columns because
 * the set changes with the UI and none of it is ever queried across users.
 */
export interface UserSettings {
  theme?: "dark" | "light" | "system";
  transcriptLanguage?: string;
  emailSummary?: boolean;
  inAppNotifications?: boolean;
  suggestionSound?: boolean;
  autoSendSummary?: boolean;
  reduceMotion?: boolean;
}

export const DEFAULT_USER_SETTINGS: Required<UserSettings> = {
  theme: "system",
  transcriptLanguage: "th-TH",
  emailSummary: true,
  inAppNotifications: true,
  suggestionSound: false,
  autoSendSummary: false,
  reduceMotion: false,
};

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

// ============================================================
// PLANS & ENTITLEMENTS
// ============================================================

export type PlanId = "free" | "pro" | "beta";

export type PlanStatus = "active" | "past_due" | "cancelled" | "expired";

export type BillingPeriod = "monthly" | "yearly";

/**
 * A capability a route can be gated on. Kept as named features rather than
 * `if (plan === 'pro')` checks so the tier table is the only place that has to
 * change when the packaging does.
 */
export type FeatureKey =
  | "live_suggestions"
  | "checkpoint"
  | "pm_document"
  | "transcript_export"
  | "session_invites"
  | "guest_access"
  | "analytics_dashboard";

export interface PlanLimits {
  /** Meetings that may be created per calendar month. null = unlimited. Enforced. */
  meetingsPerMonth: number | null;
  /** Active accounts in the workspace. null = unlimited. Enforced. */
  seats: number | null;
  /**
   * NOT ENFORCED YET. Intended cap on a single session's recording length —
   * needs a check in the session sweeper before it means anything. Shown on the
   * pricing page, so do not advertise it as a hard limit until it is wired.
   */
  sessionMinutes: number | null;
  /**
   * NOT ENFORCED YET. Intended transcript retention in days; needs a purge job.
   * null = forever.
   */
  retentionDays: number | null;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Marketing blurb. Never quote a number here — pricing is unvalidated. */
  tagline: string;
  limits: PlanLimits;
  features: FeatureKey[];
  /** Hidden from the public pricing page; assigned by an admin. */
  internal?: boolean;
}

export interface OrgPlanState {
  orgId: string;
  plan: PlanId;
  status: PlanStatus;
  isBeta: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  note: string | null;
}

export interface PlanUsage {
  meetingsThisMonth: number;
  seatsUsed: number;
  sessionsThisMonth: number;
}

export interface SubscriptionView {
  plan: PlanDefinition;
  state: OrgPlanState;
  usage: PlanUsage;
  limits: PlanLimits;
  features: FeatureKey[];
  pendingRequest: PlanRequest | null;
}

export interface PlanRequest {
  id: string;
  orgId: string;
  requestedBy: string | null;
  fromPlan: PlanId;
  toPlan: PlanId;
  billingPeriod: BillingPeriod;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
}

// ============================================================
// INVITES & GUESTS
// ============================================================

export type InviteKind = "workspace" | "session";

export interface InviteRecord {
  id: string;
  orgId: string;
  kind: InviteKind;
  role: Role;
  sessionId: string | null;
  meetingId: string | null;
  email: string | null;
  label: string | null;
  allowGuest: boolean;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** An invite plus its one-time raw token — only ever returned on create. */
export interface InviteWithLink extends InviteRecord {
  token: string;
  url: string;
}

/** The unauthenticated preview a link shows before anyone commits to joining. */
export interface InvitePreview {
  kind: InviteKind;
  role: Role;
  orgName: string;
  meetingTitle: string | null;
  sessionStatus: "created" | "active" | "ended" | null;
  allowGuest: boolean;
  requiresAccount: boolean;
  expiresAt: string | null;
  valid: boolean;
  reason?: string;
}

export interface GuestSession {
  guestId: string;
  sessionId: string;
  displayName: string;
  token: string;
}

// ============================================================
// TELEMETRY & FEEDBACK
// ============================================================

export interface TrackedEvent {
  event: string;
  surface?: string;
  sessionId?: string;
  props?: Record<string, unknown>;
}

export type FeedbackKind = "bug" | "idea" | "praise" | "nps" | "general";

export interface FeedbackRecord {
  id: string;
  orgId: string | null;
  userId: string | null;
  userName?: string | null;
  sessionId: string | null;
  kind: FeedbackKind;
  rating: number | null;
  message: string;
  surface: string | null;
  appVersion: string | null;
  status: "new" | "triaged" | "resolved" | "wontfix";
  createdAt: string;
}

export interface BetaMetrics {
  activeUsers: { daily: number; weekly: number; monthly: number };
  /** Members of this workspace. Admin metrics are workspace-scoped, not global. */
  members: { total: number };
  sessions: { total: number; last7d: number; avgMinutes: number | null };
  meetings: { total: number; last7d: number };
  checkpoint: { sessionsWithDecisions: number; decisions: number; completeRate: number | null };
  feedback: { total: number; open: number; avgRating: number | null };
  topEvents: { event: string; count: number }[];
  dailyActive: { day: string; users: number }[];
}

export interface AdminUserRow {
  id: string;
  orgId: string;
  orgName: string;
  email: string;
  name: string;
  role: Role;
  status: AccountStatus;
  authProvider: AuthProvider;
  plan: PlanId;
  createdAt: string;
  lastActiveAt: string | null;
  sessionCount: number;
}

// ============================================================
// RELEASES / UPDATE SYSTEM
// ============================================================

export interface ReleaseInfo {
  version: string;
  releasedAt: string | null;
  notes: string | null;
  /**
   * Epoch seconds. A token whose `iat` is at or below this is refused — that is
   * how a release ends every session that predates it.
   */
  minTokenIssuedAt: number;
}

/** Error codes the client keys off, so copy is not parsed from prose. */
export const AUTH_ERROR_CODES = {
  tokenRevoked: "TOKEN_REVOKED",
  accountSuspended: "ACCOUNT_SUSPENDED",
  accountRevoked: "ACCOUNT_REVOKED",
  planRequired: "PLAN_REQUIRED",
  quotaExceeded: "QUOTA_EXCEEDED",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
