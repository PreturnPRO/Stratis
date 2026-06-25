-- ==========================================================
-- STRATIS DATABASE SCHEMA — PostgreSQL
-- Sprint 1 Foundation
-- ==========================================================

-- ==========================================================
-- ORGANIZATIONS
-- ==========================================================

CREATE TABLE IF NOT EXISTS organizations (
  id          VARCHAR(255) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  created_at  VARCHAR(255) NOT NULL
);

-- ==========================================================
-- USERS
-- ==========================================================

CREATE TABLE IF NOT EXISTS users (
  id             VARCHAR(255) PRIMARY KEY,
  org_id         VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email          VARCHAR(255) NOT NULL UNIQUE,
  name           VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(50) NOT NULL CHECK (role IN ('facilitator', 'participant', 'admin')),
  created_at     VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ==========================================================
-- MEETINGS
-- ==========================================================

CREATE TABLE IF NOT EXISTS meetings (
  id            VARCHAR(255) PRIMARY KEY,
  org_id        VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id    VARCHAR(255) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  goal          TEXT,
  brief         TEXT,
  scheduled_at  VARCHAR(255),
  created_by    VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at    VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_org_id ON meetings(org_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at ON meetings(scheduled_at);

-- ==========================================================
-- SESSIONS
-- ==========================================================

CREATE TABLE IF NOT EXISTS sessions (
  id              VARCHAR(255) PRIMARY KEY,
  meeting_id      VARCHAR(255) NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  facilitator_id  VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(50) NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created', 'active', 'ended')),
  rolling_summary TEXT,
  started_at      VARCHAR(255),
  ended_at        VARCHAR(255),
  created_at      VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_meeting_id ON sessions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_sessions_facilitator_id ON sessions(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- ==========================================================
-- TRANSCRIPTS
-- ==========================================================

CREATE TABLE IF NOT EXISTS transcripts (
  id            VARCHAR(255) PRIMARY KEY,
  session_id    VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker       VARCHAR(255) NOT NULL,
  text          TEXT NOT NULL,
  chunk_signal  VARCHAR(50) CHECK (chunk_signal IS NULL OR chunk_signal IN ('IMPORTANT', 'LOW_SIGNAL', 'IGNORE')),
  timestamp     VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON transcripts(timestamp);

-- ==========================================================
-- DOCUMENTS
-- ==========================================================

CREATE TABLE IF NOT EXISTS documents (
  id          VARCHAR(255) PRIMARY KEY,
  project_id  VARCHAR(255) NOT NULL,
  org_id      VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_json  TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  VARCHAR(255) NOT NULL,
  updated_at  VARCHAR(255) NOT NULL,
  UNIQUE(project_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(org_id);

-- ==========================================================
-- DOCUMENT VERSIONS
-- ==========================================================

CREATE TABLE IF NOT EXISTS document_versions (
  id             VARCHAR(255) PRIMARY KEY,
  document_id    VARCHAR(255) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  session_id     VARCHAR(255) REFERENCES sessions(id) ON DELETE SET NULL,
  version        INTEGER NOT NULL,
  state_json     TEXT NOT NULL,
  patch_json     TEXT,
  created_by     VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at     VARCHAR(255) NOT NULL,
  UNIQUE(document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_session_id ON document_versions(session_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON document_versions(created_at);

-- ==========================================================
-- NODES
-- ==========================================================

CREATE TABLE IF NOT EXISTS nodes (
  id                   VARCHAR(255) PRIMARY KEY,
  org_id               VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id           VARCHAR(255) NOT NULL,
  session_id           VARCHAR(255) REFERENCES sessions(id) ON DELETE SET NULL,
  document_version_id  VARCHAR(255) REFERENCES document_versions(id) ON DELETE SET NULL,

  node_type            VARCHAR(50) NOT NULL CHECK (
                          node_type IN (
                            'MEETING',
                            'DECISION',
                            'ASSUMPTION',
                            'RISK',
                            'OPEN_QUESTION',
                            'SUMMARY'
                          )
                        ),

  node_category        VARCHAR(50) NOT NULL DEFAULT 'ITEM'
                          CHECK (node_category IN ('CONTAINER', 'ITEM')),

  title                TEXT NOT NULL,
  content              TEXT,
  status               VARCHAR(50) NOT NULL DEFAULT 'UNVALIDATED'
                          CHECK (
                            status IN (
                              'VALIDATED',
                              'UNVALIDATED',
                              'STALLED',
                              'BLOCKED',
                              'ARCHIVED'
                            )
                          ),

  path_state           VARCHAR(50) DEFAULT 'CHOSEN_PATH'
                          CHECK (
                            path_state IS NULL OR path_state IN (
                              'CHOSEN_PATH',
                              'ALTERNATIVE',
                              'SUPERSEDED',
                              'ARCHIVED'
                            )
                          ),

  activity_state       VARCHAR(50) DEFAULT 'ACTIVE'
                          CHECK (
                            activity_state IS NULL OR activity_state IN (
                              'ACTIVE',
                              'INACTIVE'
                            )
                          ),

  source_authority     VARCHAR(50) DEFAULT 'TRANSCRIPT_DERIVED'
                          CHECK (
                            source_authority IS NULL OR source_authority IN (
                              'PM_DOCUMENT_APPROVED',
                              'FACILITATOR_APPROVED',
                              'TEMPORARY_AI_NODE',
                              'TRANSCRIPT_DERIVED'
                            )
                          ),

  affects_pm_document  BOOLEAN NOT NULL DEFAULT FALSE,
  is_current           BOOLEAN NOT NULL DEFAULT FALSE,
  is_latest            BOOLEAN NOT NULL DEFAULT TRUE,

  confidence           DOUBLE PRECISION,
  metadata_json        TEXT,
  evidence_json        TEXT,

  created_at           VARCHAR(255) NOT NULL,
  updated_at           VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_org_id ON nodes(org_id);
CREATE INDEX IF NOT EXISTS idx_nodes_project_id ON nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_nodes_session_id ON nodes(session_id);
CREATE INDEX IF NOT EXISTS idx_nodes_document_version_id ON nodes(document_version_id);
CREATE INDEX IF NOT EXISTS idx_nodes_node_type ON nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_current ON nodes(project_id, is_current);
CREATE INDEX IF NOT EXISTS idx_nodes_latest ON nodes(project_id, is_latest);

-- ==========================================================
-- NODE RELATIONSHIPS
-- ==========================================================

CREATE TABLE IF NOT EXISTS node_relationships (
  id          VARCHAR(255) PRIMARY KEY,
  parent_id   VARCHAR(255) NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  child_id    VARCHAR(255) NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind        VARCHAR(50) NOT NULL DEFAULT 'child'
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
  created_at  VARCHAR(255) NOT NULL,
  UNIQUE(parent_id, child_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_node_relationships_parent_id ON node_relationships(parent_id);
CREATE INDEX IF NOT EXISTS idx_node_relationships_child_id ON node_relationships(child_id);
CREATE INDEX IF NOT EXISTS idx_node_relationships_kind ON node_relationships(kind);

-- ==========================================================
-- NOTIFICATIONS
-- ==========================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          VARCHAR(255) PRIMARY KEY,
  user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  VARCHAR(255) REFERENCES sessions(id) ON DELETE SET NULL,
  kind        VARCHAR(50) NOT NULL CHECK (kind IN ('summary', 'suggestion', 'system')),
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_session_id ON notifications(session_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ==========================================================
-- CONSENT LOGS
-- ==========================================================

CREATE TABLE IF NOT EXISTS consent_logs (
  id           VARCHAR(255) PRIMARY KEY,
  session_id   VARCHAR(255) REFERENCES sessions(id) ON DELETE SET NULL,
  user_id      VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  action_type  VARCHAR(50) NOT NULL CHECK (
                 action_type IN (
                   'start',
                   'pause',
                   'resume',
                   'end',
                   'grant',
                   'revoke'
                 )
               ),
  timestamp    VARCHAR(255) NOT NULL,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_consent_logs_session_id ON consent_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_timestamp ON consent_logs(timestamp);