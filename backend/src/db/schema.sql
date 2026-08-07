-- ==========================================================
-- STRATIS DATABASE UPGRADE — FINAL ER DIAGRAM (SUPABASE)
-- ==========================================================

<<<<<<< HEAD
=======
-- This file is ADDITIVE and safe to re-run against a live database: every
-- statement is CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, or CREATE
-- INDEX IF NOT EXISTS. Keep it that way.
--
-- The DROP TABLE block that used to sit here now lives in reset.sql and runs
-- only under `db:migrate --reset`. It made `db:migrate` — the command you reach
-- for when a column is missing — destroy every row in the database first.

>>>>>>> 52344f33d88b878311925b6cc781b1ce24e742fd
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

-- Set when a facilitator rewrites a generated summary block. Its presence is
-- the provenance signal the summary renders: this line is human-ratified, not
-- model output. NULL means the AI's wording is untouched.
ALTER TABLE summary_blocks ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Set when the facilitator releases the summary to participants (or the
-- auto-send countdown does). NULL means still facilitator-only. The UI's
-- "sent" state must derive from this row, never from client state alone.
ALTER TABLE participant_summaries ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- ==========================================================
-- BETA GUARD RAILS — plans, roles, invites, telemetry
-- Everything below is additive. Added for the paid/beta launch: plan
-- entitlements per workspace, account lifecycle (suspend/revoke), invite
-- links, guest session access, usage telemetry, feedback, and the release
-- record that force-logs-out stale sessions after a deploy.
-- ==========================================================

-- Workspace plan. The org is the billing unit — one plan covers the team, no
-- per-seat maths. `plan_status` is separate from `plan` so a lapsed Pro org
-- keeps its tier on record while being served Free limits.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_note TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_beta BOOLEAN NOT NULL DEFAULT FALSE;

-- Profile + account lifecycle.
-- password_hash is dropped to nullable: a Google-only account never has one.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings_json JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password';
-- active | suspended (temporary, admin can restore) | revoked (permanent).
-- Anything other than 'active' fails requireAuth on the next request.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason TEXT;
-- Any token issued at or before this instant is refused. Set on revoke,
-- suspend, password change, and role change so a permission edit takes effect
-- immediately instead of at the 7-day JWT expiry.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_valid_after TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 23. INVITES
-- kind='workspace' pulls someone into the org with a pre-set role.
-- kind='session'   grants access to one meeting session only.
-- Only the hash is stored — the raw token exists solely in the link.
CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('workspace', 'session')),
    token_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('facilitator', 'participant', 'admin')),
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    meeting_id TEXT REFERENCES meetings(id) ON DELETE CASCADE,
    email TEXT,
    label TEXT,
    allow_guest BOOLEAN NOT NULL DEFAULT FALSE,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invites_org_id ON invites(org_id);
CREATE INDEX IF NOT EXISTS idx_invites_session_id ON invites(session_id);

-- 24. INVITE REDEMPTIONS — audit trail; one row per accept, account or guest.
CREATE TABLE IF NOT EXISTS invite_redemptions (
    id TEXT PRIMARY KEY,
    invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    guest_id TEXT,
    display_name TEXT,
    redeemed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invite_redemptions_invite_id ON invite_redemptions(invite_id);

-- 25. SESSION GUESTS — link-only participants who never register.
-- Deliberately NOT rows in `users`: a guest has no org membership, no role, and
-- no login. Their token is scoped to the one session and dies with it.
CREATE TABLE IF NOT EXISTS session_guests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    invite_id TEXT REFERENCES invites(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_guests_session_id ON session_guests(session_id);

-- 26. SESSION PARTICIPANTS — who was actually in the room, account or guest.
CREATE TABLE IF NOT EXISTS session_participants (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    guest_id TEXT REFERENCES session_guests(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'participant',
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ,
    CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_participants_user
  ON session_participants(session_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_participants_guest
  ON session_participants(session_id, guest_id) WHERE guest_id IS NOT NULL;

-- 27. ANALYTICS EVENTS — self-hosted beta telemetry. No third party.
-- Append-only. `props_json` is free-form per event name; keep it small and
-- never put transcript text or anything a participant said in it.
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    guest_id TEXT REFERENCES session_guests(id) ON DELETE SET NULL,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    surface TEXT,
    props_json JSONB,
    app_version TEXT,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org_created ON analytics_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);

-- 28. FEEDBACK — beta team's own words, kept next to the numbers.
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('bug', 'idea', 'praise', 'nps', 'general')),
    rating INTEGER,
    message TEXT NOT NULL,
    surface TEXT,
    app_version TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'resolved', 'wontfix')),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_org_created ON feedback(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- 29. APP RELEASES — the update system's record.
-- A row with force_logout = TRUE invalidates every token issued before
-- `released_at`, which is how a deploy ends stale sessions carrying an old
-- client build. The frontend polls /api/system/version for the same row.
CREATE TABLE IF NOT EXISTS app_releases (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    notes TEXT,
    force_logout BOOLEAN NOT NULL DEFAULT FALSE,
    released_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    released_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_releases_released_at ON app_releases(released_at DESC);

-- 30. PLAN REQUESTS — beta has no payment gateway, so an upgrade is a request
-- an admin approves by hand. Keeps intent-to-pay measurable without charging.
CREATE TABLE IF NOT EXISTS plan_requests (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    from_plan TEXT NOT NULL,
    to_plan TEXT NOT NULL,
    billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_requests_org ON plan_requests(org_id, created_at DESC);

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