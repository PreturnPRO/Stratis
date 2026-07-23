-- ==========================================================
-- STRATIS DATABASE UPGRADE — FINAL ER DIAGRAM (SUPABASE)
-- ==========================================================

-- Drop S1 tables if we want to run a clean, synchronized reset
DROP TABLE IF EXISTS action_items CASCADE;
DROP TABLE IF EXISTS summary_blocks CASCADE;
DROP TABLE IF EXISTS participant_summaries CASCADE;
DROP TABLE IF EXISTS live_card_evidence CASCADE;
DROP TABLE IF EXISTS live_cards CASCADE;
DROP TABLE IF EXISTS node_evidence CASCADE;
DROP TABLE IF EXISTS document_patch_evidence CASCADE;
DROP TABLE IF EXISTS document_patch_items CASCADE;
DROP TABLE IF EXISTS document_patches CASCADE;
DROP TABLE IF EXISTS node_relationships CASCADE;
DROP TABLE IF EXISTS nodes CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS transcripts CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS consent_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- 1. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- 2. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(org_id, slug)
);

-- 3. USERS
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('facilitator', 'participant', 'admin')),
    created_at TIMESTAMPTZ NOT NULL
);

-- 4. MEETINGS
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    goal TEXT,
    brief TEXT,
    duration_minutes INTEGER,
    scheduled_at TIMESTAMPTZ,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- 5. SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    facilitator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'ended')),
    rolling_summary TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

-- 6. TRANSCRIPTS
CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    speaker TEXT NOT NULL,
    text TEXT NOT NULL,
    chunk_signal TEXT CHECK (chunk_signal IS NULL OR chunk_signal IN ('IMPORTANT', 'LOW_SIGNAL', 'IGNORE')),
    timestamp TIMESTAMPTZ NOT NULL,
    source TEXT,
    metadata_json JSONB
);

-- 7. DOCUMENTS
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT,
    state_json JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1, -- Named current_version in ER, mapping 'version' for active S1 runtime
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(project_id, org_id)
);

-- 8. DOCUMENT VERSIONS
CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    version INTEGER NOT NULL,
    state_json JSONB NOT NULL,
    patch_json JSONB,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE(document_id, version)
);

-- 9. DOCUMENT PATCHES (Post-Meeting Patches Metadata)
CREATE TABLE IF NOT EXISTS document_patches (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    version INTEGER NOT NULL,
    base_document_version INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    overall_change_summary TEXT,
    requires_facilitator_review BOOLEAN NOT NULL DEFAULT TRUE,
    reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL,
    reviewed_at TIMESTAMPTZ
);

-- 10. DOCUMENT PATCH ITEMS (Targeted Section Operations)
CREATE TABLE IF NOT EXISTS document_patch_items (
    id TEXT PRIMARY KEY,
    document_patch_id TEXT NOT NULL REFERENCES document_patches(id) ON DELETE CASCADE,
    operation TEXT NOT NULL CHECK (operation IN ('replace_section', 'append_to_section', 'insert_section')),
    section_key TEXT NOT NULL CHECK (section_key IN ('project_brief', 'current_status', 'current_project_direction', 'active_risks', 'key_constraints', 'context_needed_for_next_meeting')),
    section_title TEXT NOT NULL,
    new_content TEXT NOT NULL,
    reason TEXT,
    confidence REAL
);

-- 11. DOCUMENT PATCH EVIDENCE (Traceability links)
CREATE TABLE IF NOT EXISTS document_patch_evidence (
    id TEXT PRIMARY KEY,
    document_patch_item_id TEXT NOT NULL REFERENCES document_patch_items(id) ON DELETE CASCADE,
    transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    timestamp_start TIMESTAMPTZ,
    timestamp_end TIMESTAMPTZ,
    speaker TEXT,
    quote TEXT
);

-- 12. NODES (Tree Layer)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    document_version_id TEXT REFERENCES document_versions(id) ON DELETE SET NULL,
    node_type TEXT NOT NULL CHECK (node_type IN ('MEETING', 'DECISION', 'ASSUMPTION', 'RISK', 'OPEN_QUESTION', 'SUMMARY')),
    node_category TEXT NOT NULL DEFAULT 'ITEM' CHECK (node_category IN ('CONTAINER', 'ITEM')),
    title TEXT NOT NULL,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'UNVALIDATED' CHECK (status IN ('VALIDATED', 'UNVALIDATED', 'STALLED', 'BLOCKED', 'ARCHIVED')),
    path_state TEXT DEFAULT 'CHOSEN_PATH' CHECK (path_state IS NULL OR path_state IN ('CHOSEN_PATH', 'ALTERNATIVE', 'SUPERSEDED', 'ARCHIVED')),
    activity_state TEXT DEFAULT 'ACTIVE' CHECK (activity_state IS NULL OR activity_state IN ('ACTIVE', 'INACTIVE')),
    source_authority TEXT DEFAULT 'TRANSCRIPT_DERIVED' CHECK (source_authority IS NULL OR source_authority IN ('PM_DOCUMENT_APPROVED', 'FACILITATOR_APPROVED', 'TEMPORARY_AI_NODE', 'TRANSCRIPT_DERIVED')),
    affects_pm_document BOOLEAN NOT NULL DEFAULT FALSE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    is_latest BOOLEAN NOT NULL DEFAULT TRUE,
    confidence REAL,
    metadata_json JSONB,
    evidence_json JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- 13. NODE RELATIONSHIPS
CREATE TABLE IF NOT EXISTS node_relationships (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    child_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'child' CHECK (kind IN ('child', 'depends_on', 'blocks', 'related', 'supersedes', 'references', 'validates', 'conflicts_with')),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE(parent_id, child_id, kind)
);

-- 14. NODE EVIDENCE
CREATE TABLE IF NOT EXISTS node_evidence (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    timestamp_start TIMESTAMPTZ,
    timestamp_end TIMESTAMPTZ,
    speaker TEXT,
    quote TEXT
);

-- 15. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('summary', 'suggestion', 'system')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL
);

-- 16. CONSENT LOGS
CREATE TABLE IF NOT EXISTS consent_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('start', 'pause', 'resume', 'end', 'grant', 'revoke')),
    timestamp TIMESTAMPTZ NOT NULL,
    metadata_json JSONB
);

-- 17. LIVE CARDS (Database Suggestions Store)
CREATE TABLE IF NOT EXISTS live_cards (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    card_type TEXT NOT NULL CHECK (card_type IN ('QUESTION_SUGGESTION', 'DRIFT_ALERT', 'MISSING_DECISION', 'UNRESOLVED_ASSUMPTION')),
    title TEXT NOT NULL,
    brief_description TEXT NOT NULL,
    suggested_question TEXT,
    urgency TEXT NOT NULL CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH')),
    state TEXT NOT NULL DEFAULT 'NEW' CHECK (state IN ('NEW', 'AWARE', 'ANSWERED', 'DISMISSED', 'ESCALATED_TO_OPEN_QUESTION', 'LINKED_TO_DOCUMENT_PATCH')),
    confidence REAL,
    answered BOOLEAN NOT NULL DEFAULT FALSE,
    answered_by TEXT CHECK (answered_by IN ('auto', 'manual')),
    created_at TIMESTAMPTZ NOT NULL,
    answered_at TIMESTAMPTZ
);

-- 18. LIVE CARD EVIDENCE
CREATE TABLE IF NOT EXISTS live_card_evidence (
    id TEXT PRIMARY KEY,
    live_card_id TEXT NOT NULL REFERENCES live_cards(id) ON DELETE CASCADE,
    transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    timestamp_start TIMESTAMPTZ,
    timestamp_end TIMESTAMPTZ,
    speaker TEXT,
    quote TEXT
);

-- 19. PARTICIPANT SUMMARIES
CREATE TABLE IF NOT EXISTS participant_summaries (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    summary_title TEXT NOT NULL,
    summary_subtitle TEXT NOT NULL,
    participants_json JSONB NOT NULL,
    duration_minutes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ
);

-- 20. SUMMARY BLOCKS
CREATE TABLE IF NOT EXISTS summary_blocks (
    id TEXT PRIMARY KEY,
    summary_id TEXT NOT NULL REFERENCES participant_summaries(id) ON DELETE CASCADE,
    block_type TEXT NOT NULL CHECK (block_type IN ('OVERVIEW', 'WHAT_CHANGED', 'DECISIONS', 'OPEN_ITEMS', 'ASSUMPTIONS', 'RISKS', 'ACTION_ITEMS', 'NEXT_STEPS')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    visible_to_participants BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL
);

-- 21. ACTION ITEMS
CREATE TABLE IF NOT EXISTS action_items (
    id TEXT PRIMARY KEY,
    summary_id TEXT NOT NULL REFERENCES participant_summaries(id) ON DELETE CASCADE,
    task TEXT NOT NULL,
    owner TEXT NOT NULL,
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
);

-- 22. DECISIONS (alignment checkpoint)
-- One row per decision the AI extracts from a session's transcript. The closing
-- checkpoint, the honest summary, and the completeness metric all read this.
-- status: complete (has a due date), incomplete (a real decision missing one),
-- open (deliberately parked — carries a revisit note). source flips ai ->
-- facilitator once the checkpoint edits/confirms a row. due_date is TEXT, not a
-- timestamp: the room often gives a phrase ("end of month") we keep verbatim.
CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    due_date TEXT,
    owner TEXT,
    scope TEXT,
    status TEXT NOT NULL CHECK (status IN ('complete', 'incomplete', 'open')),
    revisit TEXT,
    missing TEXT,
    confidence REAL,
    source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'facilitator')),
    -- Soft-dismiss from the checkpoint: row kept (undoable, and the dedupe
    -- must keep seeing its text so re-extract can't resurrect it), but
    -- excluded from the metric and the summary.
    dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Additive upgrade for databases that created the table before `dismissed`.
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT FALSE;

-- ==========================================================
-- PERFORMANCE TUNING INDEX SCALE
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);

CREATE INDEX IF NOT EXISTS idx_meetings_org_id ON meetings(org_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);

CREATE INDEX IF NOT EXISTS idx_sessions_meeting_id ON sessions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON transcripts(timestamp);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);

CREATE INDEX IF NOT EXISTS idx_document_patches_document_id ON document_patches(document_id);
CREATE INDEX IF NOT EXISTS idx_document_patches_session_id ON document_patches(session_id);

CREATE INDEX IF NOT EXISTS idx_nodes_project_id ON nodes(project_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_live_cards_session_id ON live_cards(session_id);
CREATE INDEX IF NOT EXISTS idx_live_cards_answered ON live_cards(answered);

CREATE INDEX IF NOT EXISTS idx_consent_logs_session_id ON consent_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_decisions_session_id ON decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting_id ON decisions(meeting_id);

-- One summary per session — the session-end hook and the summary GET's lazy
-- backfill can race; the unique index makes the second writer a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_summaries_session
  ON participant_summaries(session_id);