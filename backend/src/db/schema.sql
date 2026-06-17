-- ==========================================================
-- STRATIS DATABASE SCHEMA — SQLite
-- Sprint 1 Foundation
--
-- PM Document = Source of Truth
-- Tree = Historical / Retrieval Layer
--
-- Compatible with:
-- backend/src/db/database.ts using node:sqlite
-- backend/src/db/seed.ts
-- ==========================================================


-- ==========================================================
-- ORGANIZATIONS
-- ==========================================================

CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);


-- ==========================================================
-- USERS
-- ==========================================================

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('facilitator', 'participant', 'admin')),
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_org_id
ON users(org_id);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);


-- ==========================================================
-- MEETINGS
-- Meeting metadata.
-- A session links to one meeting.
-- ==========================================================

CREATE TABLE IF NOT EXISTS meetings (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id    TEXT NOT NULL,
  title         TEXT NOT NULL,
  -- Human-owned meeting goal (schema spec §7.4) + free-form brief/agenda.
  -- Captured before the meeting; fed to the live AI as context, never AI-rewritten.
  goal          TEXT,
  brief         TEXT,
  scheduled_at  TEXT,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_org_id
ON meetings(org_id);

CREATE INDEX IF NOT EXISTS idx_meetings_project_id
ON meetings(project_id);

CREATE INDEX IF NOT EXISTS idx_meetings_created_by
ON meetings(created_by);

CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at
ON meetings(scheduled_at);


-- ==========================================================
-- SESSIONS
-- Meeting lifecycle:
-- created -> active -> ended
--
-- Session ID anchors:
-- transcripts
-- live cards / AI outputs later
-- summaries
-- tree nodes
-- ==========================================================

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  meeting_id      TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  facilitator_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created', 'active', 'ended')),
  started_at      TEXT,
  ended_at        TEXT,
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_meeting_id
ON sessions(meeting_id);

CREATE INDEX IF NOT EXISTS idx_sessions_facilitator_id
ON sessions(facilitator_id);

CREATE INDEX IF NOT EXISTS idx_sessions_status
ON sessions(status);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at
ON sessions(created_at);


-- ==========================================================
-- TRANSCRIPTS
-- Raw transcript rows linked to session.
-- Raw transcript should be saved regardless of AI chunk signal.
-- ==========================================================

CREATE TABLE IF NOT EXISTS transcripts (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker     TEXT NOT NULL,
  text        TEXT NOT NULL,
  timestamp   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session_id
ON transcripts(session_id);

CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp
ON transcripts(timestamp);


-- ==========================================================
-- DOCUMENTS
-- Current PM document state.
-- One current document row per project/org.
-- The PM document is the source of truth.
-- ==========================================================

CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_json  TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE(project_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id
ON documents(project_id);

CREATE INDEX IF NOT EXISTS idx_documents_org_id
ON documents(org_id);


-- ==========================================================
-- DOCUMENT VERSIONS
-- Immutable document history snapshots.
-- Sprint 2 document patch approval will append here.
-- ==========================================================

CREATE TABLE IF NOT EXISTS document_versions (
  id             TEXT PRIMARY KEY,
  document_id    TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  session_id     TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  version        INTEGER NOT NULL,
  state_json     TEXT NOT NULL,
  patch_json     TEXT,
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL,
  UNIQUE(document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id
ON document_versions(document_id);

CREATE INDEX IF NOT EXISTS idx_document_versions_session_id
ON document_versions(session_id);

CREATE INDEX IF NOT EXISTS idx_document_versions_created_at
ON document_versions(created_at);


-- ==========================================================
-- NODES
-- Tree/history layer.
-- Not the source of truth.
-- Nodes can link to session and document version evidence.
-- ==========================================================

CREATE TABLE IF NOT EXISTS nodes (
  id                   TEXT PRIMARY KEY,
  org_id               TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id            TEXT NOT NULL,
  session_id            TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  document_version_id   TEXT REFERENCES document_versions(id) ON DELETE SET NULL,

  node_type             TEXT NOT NULL CHECK (
                          node_type IN (
                            'MEETING',
                            'DECISION',
                            'ASSUMPTION',
                            'RISK',
                            'OPEN_QUESTION',
                            'SUMMARY'
                          )
                        ),

  node_category         TEXT NOT NULL DEFAULT 'ITEM'
                          CHECK (node_category IN ('CONTAINER', 'ITEM')),

  title                 TEXT NOT NULL,
  content               TEXT,
  status                TEXT NOT NULL DEFAULT 'UNVALIDATED'
                          CHECK (
                            status IN (
                              'VALIDATED',
                              'UNVALIDATED',
                              'STALLED',
                              'BLOCKED',
                              'ARCHIVED'
                            )
                          ),

  path_state            TEXT DEFAULT 'CHOSEN_PATH'
                          CHECK (
                            path_state IS NULL OR path_state IN (
                              'CHOSEN_PATH',
                              'ALTERNATIVE',
                              'SUPERSEDED',
                              'ARCHIVED'
                            )
                          ),

  activity_state        TEXT DEFAULT 'ACTIVE'
                          CHECK (
                            activity_state IS NULL OR activity_state IN (
                              'ACTIVE',
                              'INACTIVE'
                            )
                          ),

  source_authority      TEXT DEFAULT 'TRANSCRIPT_DERIVED'
                          CHECK (
                            source_authority IS NULL OR source_authority IN (
                              'PM_DOCUMENT_APPROVED',
                              'FACILITATOR_APPROVED',
                              'TEMPORARY_AI_NODE',
                              'TRANSCRIPT_DERIVED'
                            )
                          ),

  affects_pm_document   INTEGER NOT NULL DEFAULT 0 CHECK (affects_pm_document IN (0, 1)),
  is_current            INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  is_latest             INTEGER NOT NULL DEFAULT 1 CHECK (is_latest IN (0, 1)),

  confidence            REAL,
  metadata_json         TEXT,
  evidence_json         TEXT,

  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_org_id
ON nodes(org_id);

CREATE INDEX IF NOT EXISTS idx_nodes_project_id
ON nodes(project_id);

CREATE INDEX IF NOT EXISTS idx_nodes_session_id
ON nodes(session_id);

CREATE INDEX IF NOT EXISTS idx_nodes_document_version_id
ON nodes(document_version_id);

CREATE INDEX IF NOT EXISTS idx_nodes_node_type
ON nodes(node_type);

CREATE INDEX IF NOT EXISTS idx_nodes_status
ON nodes(status);

CREATE INDEX IF NOT EXISTS idx_nodes_current
ON nodes(project_id, is_current);

CREATE INDEX IF NOT EXISTS idx_nodes_latest
ON nodes(project_id, is_latest);


-- ==========================================================
-- NODE RELATIONSHIPS
-- Tree edges between nodes.
-- ==========================================================

CREATE TABLE IF NOT EXISTS node_relationships (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  child_id    TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'child'
                CHECK (
                  kind IN (
                    'child',
                    'depends_on',
                    'blocks',
                    'related',
                    'supersedes',
                    'references',
                    'validates',
                    'conflicts_with'
                  )
                ),
  created_at  TEXT NOT NULL,
  UNIQUE(parent_id, child_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_node_relationships_parent_id
ON node_relationships(parent_id);

CREATE INDEX IF NOT EXISTS idx_node_relationships_child_id
ON node_relationships(child_id);

CREATE INDEX IF NOT EXISTS idx_node_relationships_kind
ON node_relationships(kind);


-- ==========================================================
-- NOTIFICATIONS
-- Used for summaries, suggestions, and system messages.
-- Current seed inserts summary notification rows here.
-- ==========================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('summary', 'suggestion', 'system')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  read        INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_session_id
ON notifications(session_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read
ON notifications(read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
ON notifications(created_at);


-- ==========================================================
-- CONSENT LOGS
-- Privacy/consent audit trail.
-- Sprint 4 PDPA work builds on this.
-- ==========================================================

CREATE TABLE IF NOT EXISTS consent_logs (
  id           TEXT PRIMARY KEY,
  session_id   TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  action_type  TEXT NOT NULL CHECK (
                 action_type IN (
                   'start',
                   'pause',
                   'resume',
                   'end',
                   'grant',
                   'revoke'
                 )
               ),
  timestamp    TEXT NOT NULL,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_consent_logs_session_id
ON consent_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id
ON consent_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_consent_logs_timestamp
ON consent_logs(timestamp);