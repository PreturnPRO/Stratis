-- ─────────────────────────────────────────────────────────────────────────────
-- Stratis schema (S1-T00-A)
-- All tables created before any feature task writes to the DB.
-- SQLite dialect. Foreign keys ON. UUID/ISO strings are app-generated.
-- ─────────────────────────────────────────────────────────────────────────────
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('facilitator','participant','admin')),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   TEXT,
  title        TEXT NOT NULL,
  scheduled_at TEXT,
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT PRIMARY KEY,
  meeting_id     TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  facilitator_id TEXT NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','active','ended')),
  started_at     TEXT,
  ended_at       TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcripts (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker     TEXT NOT NULL,
  text        TEXT NOT NULL,
  timestamp   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);

-- Living strategy document, one current row per project (S2 builds on this).
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_json  TEXT NOT NULL,        -- current document state
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_versions (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  state_json   TEXT NOT NULL,
  trigger      TEXT,                -- what caused this version
  created_at   TEXT NOT NULL
);

-- Decision/strategy tree nodes (rendered by BlockRenderer; grows in S2/S3).
CREATE TABLE IF NOT EXISTS nodes (
  id          TEXT PRIMARY KEY,
  session_id  TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  project_id  TEXT,
  type        TEXT NOT NULL,        -- TextBlock | DecisionNode | SummaryBlock | QuestionSuggestion
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  metadata    TEXT,                 -- JSON: status/options/priority/etc.
  created_by  TEXT,                 -- 'ai' or user id (human vs AI provenance)
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nodes_session ON nodes(session_id);

CREATE TABLE IF NOT EXISTS node_relationships (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  child_id    TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'child',  -- child | depends_on | blocks
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,        -- summary | suggestion | system
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  read        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- Consent / privacy audit trail (foundation for S4 PDPA work).
CREATE TABLE IF NOT EXISTS consent_logs (
  id          TEXT PRIMARY KEY,
  session_id  TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,        -- start | pause | resume | end
  timestamp   TEXT NOT NULL
);