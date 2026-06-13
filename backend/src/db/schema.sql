-- ==========================================================
-- STRATIS AI DATABASE SCHEMA
-- PostgreSQL 16+
-- PM Document = Source of Truth
-- Tree = Historical / Retrieval Layer
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================================
-- ENUMS
-- ==========================================================

CREATE TYPE node_type_enum AS ENUM (
  'MEETING',
  'DECISION',
  'ASSUMPTION',
  'RISK',
  'OPEN_QUESTION'
);

CREATE TYPE node_category_enum AS ENUM (
  'CONTAINER',
  'ITEM'
);

CREATE TYPE status_enum AS ENUM (
  'VALIDATED',
  'UNVALIDATED',
  'STALLED',
  'BLOCKED'
);

CREATE TYPE path_state_enum AS ENUM (
  'CHOSEN_PATH',
  'ALTERNATIVE',
  'SUPERSEDED',
  'ARCHIVED'
);

CREATE TYPE activity_state_enum AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

CREATE TYPE source_authority_enum AS ENUM (
  'PM_DOCUMENT_APPROVED',
  'FACILITATOR_APPROVED',
  'TEMPORARY_AI_NODE',
  'TRANSCRIPT_DERIVED'
);

CREATE TYPE card_type_enum AS ENUM (
  'QUESTION_SUGGESTION',
  'DRIFT_ALERT',
  'MISSING_DECISION',
  'UNRESOLVED_ASSUMPTION'
);

CREATE TYPE card_state_enum AS ENUM (
  'NEW',
  'AWARE',
  'ANSWERED',
  'DISMISSED',
  'ESCALATED_TO_OPEN_QUESTION',
  'LINKED_TO_DOCUMENT_PATCH'
);

CREATE TYPE urgency_enum AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TYPE chunk_signal_enum AS ENUM (
  'IMPORTANT',
  'LOW_SIGNAL',
  'IGNORE'
);

CREATE TYPE impact_level_enum AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TYPE patch_operation_enum AS ENUM (
  'REPLACE_SECTION',
  'APPEND_TO_SECTION',
  'INSERT_SECTION'
);

CREATE TYPE patch_approval_status_enum AS ENUM (
  'PENDING',
  'APPROVED',
  'EDITED_APPROVED',
  'REJECTED'
);

CREATE TYPE review_priority_enum AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TYPE node_event_type_enum AS ENUM (
  'STATUS_CHANGED',
  'PATH_STATE_CHANGED',
  'ACTIVITY_STATE_CHANGED',
  'NODE_SUPERSEDED',
  'NODE_REFERENCED'
);

CREATE TYPE node_link_type_enum AS ENUM (
  'RELATED',
  'SUPERSEDES',
  'DEPENDS_ON',
  'REFERENCES',
  'VALIDATES',
  'CONFLICTS_WITH'
);

CREATE TYPE summary_block_type_enum AS ENUM (
  'OVERVIEW',
  'WHAT_CHANGED',
  'DECISIONS',
  'OPEN_ITEMS',
  'ASSUMPTIONS',
  'RISKS',
  'ACTION_ITEMS',
  'NEXT_STEPS'
);

CREATE TYPE action_source_enum AS ENUM (
  'TRANSCRIPT',
  'DOCUMENT_PATCH',
  'LIVE_CARD',
  'FACILITATOR_EDIT'
);

CREATE TYPE open_question_source_enum AS ENUM (
  'TRANSCRIPT',
  'UNRESOLVED_LIVE_CARD',
  'DOCUMENT_PATCH',
  'FACILITATOR_EDIT'
);

CREATE TYPE send_status_enum AS ENUM (
  'PENDING',
  'SCHEDULED',
  'SENT',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE source_ref_type_enum AS ENUM (
  'DOCUMENT_PATCH',
  'TREE_NODE',
  'TRANSCRIPT',
  'LIVE_CARD'
);

CREATE TYPE evidence_entity_type_enum AS ENUM (
  'LIVE_CARD',
  'DOCUMENT_PATCH',
  'DOCUMENT_PATCH_ITEM',
  'TREE_NODE',
  'NODE_EVENT',
  'ACTION_ITEM',
  'OPEN_QUESTION',
  'SUMMARY_BLOCK',
  'PARTICIPANT_SUMMARY'
);

-- ==========================================================
-- PROJECTS
-- ==========================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- PM DOCUMENTS
-- Source of truth document.
-- One new row per approved version.
-- ==========================================================

CREATE TABLE pm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,

  project_brief TEXT,
  current_status TEXT,
  current_project_direction TEXT,
  active_risks TEXT,
  key_constraints TEXT,
  context_needed_for_next_meeting TEXT,

  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(project_id, version)
);

-- ==========================================================
-- MEETINGS
-- Meeting metadata.
-- The visual meeting node is stored in tree_nodes as node_type = MEETING.
-- ==========================================================

CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,

  user_title TEXT NOT NULL,
  meeting_goal TEXT,
  agenda TEXT,

  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- TRANSCRIPT CHUNKS
-- Used by live AI and rolling memory.
-- ==========================================================

CREATE TABLE transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id TEXT NOT NULL,
  chunk_ref TEXT NOT NULL,
  chunk_signal chunk_signal_enum NOT NULL,
  rolling_memory_update TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(session_id, chunk_ref)
);

-- ==========================================================
-- LIVE CARDS
-- Generated during meetings.
-- ==========================================================

CREATE TABLE live_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id TEXT NOT NULL,
  chunk_id TEXT,

  card_type card_type_enum NOT NULL,

  title TEXT NOT NULL,
  brief_description TEXT NOT NULL,
  suggested_question TEXT,
  urgency urgency_enum NOT NULL DEFAULT 'MEDIUM',
  related_agenda_item TEXT,
  reason_now TEXT,
  expected_resolution_signal TEXT,

  confidence NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1),

  state card_state_enum NOT NULL DEFAULT 'NEW',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- DOCUMENT PATCHES
-- Batch-level AI patch proposal.
-- ==========================================================

CREATE TABLE document_patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  document_version INTEGER NOT NULL,
  overall_change_summary TEXT,

  approved BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- DOCUMENT PATCH ITEMS
-- Individual patch operations.
-- Facilitator approves/rejects/edits these one by one.
-- ==========================================================

CREATE TABLE document_patch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patch_id UUID NOT NULL REFERENCES document_patches(id) ON DELETE CASCADE,

  client_patch_id TEXT,

  operation patch_operation_enum NOT NULL,
  section_key TEXT NOT NULL,
  section_title TEXT NOT NULL,

  new_content TEXT NOT NULL,
  edited_content TEXT,

  reason TEXT,
  confidence NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1),

  requires_facilitator_review BOOLEAN NOT NULL DEFAULT TRUE,
  review_priority review_priority_enum NOT NULL DEFAULT 'MEDIUM',

  approval_status patch_approval_status_enum NOT NULL DEFAULT 'PENDING',
  approved_by UUID,
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- TREE NODES
-- Visual project memory.
-- Includes MEETING container nodes and child item nodes.
-- ==========================================================

CREATE TABLE tree_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  parent_node_id UUID REFERENCES tree_nodes(id) ON DELETE SET NULL,

  node_type node_type_enum NOT NULL,
  node_category node_category_enum NOT NULL,

  title TEXT NOT NULL,
  subtitle TEXT,

  brief_detail TEXT,
  key_change TEXT,

  status status_enum,
  path_state path_state_enum,
  activity_state activity_state_enum,

  source_authority source_authority_enum,
  affects_pm_document BOOLEAN DEFAULT FALSE,

  confidence NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1),

  summary_for_ai TEXT,

  is_current BOOLEAN DEFAULT FALSE,
  is_latest BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- NODE EVENTS
-- Immutable node history.
-- Do not rewrite original node content.
-- Track status/path/activity changes here.
-- ==========================================================

CREATE TABLE node_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  target_node_id UUID NOT NULL REFERENCES tree_nodes(id) ON DELETE CASCADE,

  event_type node_event_type_enum NOT NULL,
  from_value TEXT,
  to_value TEXT,

  reason TEXT,
  confidence NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- NODE TAGS
-- For filtering and retrieval.
-- ==========================================================

CREATE TABLE node_tags (
  node_id UUID NOT NULL REFERENCES tree_nodes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,

  PRIMARY KEY (node_id, tag)
);

-- ==========================================================
-- NODE TOPICS
-- For AI retrieval library.
-- ==========================================================

CREATE TABLE node_topics (
  node_id UUID NOT NULL REFERENCES tree_nodes(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,

  PRIMARY KEY (node_id, topic)
);

-- ==========================================================
-- NODE LINKS
-- Relationships between nodes.
-- ==========================================================

CREATE TABLE node_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source_node_id UUID NOT NULL REFERENCES tree_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES tree_nodes(id) ON DELETE CASCADE,

  link_type node_link_type_enum NOT NULL,
  reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- NODE ALTERNATIVES
-- Seriously discussed alternatives and why not chosen.
-- ==========================================================

CREATE TABLE node_alternatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  node_id UUID NOT NULL REFERENCES tree_nodes(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  reason_not_chosen TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- EVIDENCE REFERENCES
-- Polymorphic evidence link.
-- This attaches transcript evidence to any AI-generated entity.
-- ==========================================================

CREATE TABLE evidence_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type evidence_entity_type_enum NOT NULL,
  entity_id UUID NOT NULL,

  transcript_ref TEXT,
  timestamp_start TIME,
  timestamp_end TIME,
  speaker TEXT,
  quote TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- PARTICIPANT SUMMARIES
-- Generated after approved document update.
-- ==========================================================

CREATE TABLE participant_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,

  source_document_version INTEGER NOT NULL,

  summary_title TEXT NOT NULL,
  summary_subtitle TEXT,

  requires_facilitator_review BOOLEAN NOT NULL DEFAULT FALSE,
  auto_send_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  auto_send_deadline_minutes INTEGER NOT NULL DEFAULT 5,

  send_status send_status_enum NOT NULL DEFAULT 'PENDING',
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- SUMMARY BLOCKS
-- Rendered sections of participant summary.
-- Not tree nodes.
-- ==========================================================

CREATE TABLE summary_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  summary_id UUID NOT NULL REFERENCES participant_summaries(id) ON DELETE CASCADE,

  block_type summary_block_type_enum NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  visible_to_participants BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- SUMMARY DOCUMENT CHANGES
-- Human-readable "What Changed" section.
-- Not raw patch logs.
-- ==========================================================

CREATE TABLE summary_document_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  summary_id UUID NOT NULL REFERENCES participant_summaries(id) ON DELETE CASCADE,

  section_title TEXT NOT NULL,
  change_summary TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- SUMMARY SOURCE REFS
-- Hidden/toggleable source references.
-- ==========================================================

CREATE TABLE summary_source_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  summary_id UUID NOT NULL REFERENCES participant_summaries(id) ON DELETE CASCADE,

  ref_type source_ref_type_enum NOT NULL,
  ref_id UUID NOT NULL,

  visible_by_default BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- ACTION ITEMS
-- Summary action items.
-- Only affects PM doc if affects_project_state = true.
-- ==========================================================

CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  summary_id UUID NOT NULL REFERENCES participant_summaries(id) ON DELETE CASCADE,

  task TEXT NOT NULL,
  owner TEXT,
  due_date DATE,

  source action_source_enum NOT NULL,

  affects_project_state BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- OPEN QUESTIONS
-- Structured open questions for summary and review.
-- These may become OPEN_QUESTION tree nodes after facilitator review.
-- ==========================================================

CREATE TABLE open_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  summary_id UUID REFERENCES participant_summaries(id) ON DELETE CASCADE,

  question TEXT NOT NULL,
  owner TEXT,

  source open_question_source_enum NOT NULL,

  should_become_tree_node BOOLEAN NOT NULL DEFAULT FALSE,
  related_live_card_id UUID REFERENCES live_cards(id) ON DELETE SET NULL,
  tree_node_id UUID REFERENCES tree_nodes(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- FACILITATOR ONLY NOTES
-- Low-confidence warnings, review warnings, internal notes.
-- Not visible to normal participants.
-- ==========================================================

CREATE TABLE facilitator_only_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  summary_id UUID REFERENCES participant_summaries(id) ON DELETE CASCADE,

  note_type TEXT NOT NULL,
  message TEXT NOT NULL,
  confidence NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- INDEXES
-- ==========================================================

CREATE INDEX idx_pm_documents_project_version
ON pm_documents(project_id, version);

CREATE INDEX idx_meetings_project_id
ON meetings(project_id);

CREATE INDEX idx_meetings_session_id
ON meetings(session_id);

CREATE INDEX idx_transcript_chunks_session
ON transcript_chunks(session_id);

CREATE INDEX idx_live_cards_session
ON live_cards(session_id);

CREATE INDEX idx_live_cards_state
ON live_cards(state);

CREATE INDEX idx_document_patches_project
ON document_patches(project_id);

CREATE INDEX idx_document_patch_items_patch
ON document_patch_items(patch_id);

CREATE INDEX idx_tree_nodes_project
ON tree_nodes(project_id);

CREATE INDEX idx_tree_nodes_meeting
ON tree_nodes(meeting_id);

CREATE INDEX idx_tree_nodes_parent
ON tree_nodes(parent_node_id);

CREATE INDEX idx_tree_nodes_type
ON tree_nodes(node_type);

CREATE INDEX idx_tree_nodes_current
ON tree_nodes(project_id, is_current);

CREATE INDEX idx_node_events_target
ON node_events(target_node_id);

CREATE INDEX idx_node_links_source
ON node_links(source_node_id);

CREATE INDEX idx_node_links_target
ON node_links(target_node_id);

CREATE INDEX idx_evidence_entity
ON evidence_refs(entity_type, entity_id);

CREATE INDEX idx_participant_summaries_project
ON participant_summaries(project_id);

CREATE INDEX idx_participant_summaries_session
ON participant_summaries(session_id);

CREATE INDEX idx_summary_blocks_summary
ON summary_blocks(summary_id);

CREATE INDEX idx_summary_document_changes_summary
ON summary_document_changes(summary_id);

CREATE INDEX idx_summary_source_refs_summary
ON summary_source_refs(summary_id);

CREATE INDEX idx_action_items_summary
ON action_items(summary_id);

CREATE INDEX idx_open_questions_summary
ON open_questions(summary_id);