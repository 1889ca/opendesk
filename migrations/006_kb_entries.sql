-- Knowledge Base entries with lifecycle governance and version tracking.
-- All statements use IF NOT EXISTS / idempotent guards.

CREATE TABLE IF NOT EXISTS kb_entries (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'published', 'deprecated')),
  version INTEGER NOT NULL DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_entries_workspace
  ON kb_entries (workspace_id);

CREATE INDEX IF NOT EXISTS idx_kb_entries_workspace_status
  ON kb_entries (workspace_id, status);

-- Version snapshots: immutable historical record of each content revision.
CREATE TABLE IF NOT EXISTS kb_entry_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_id, version)
);

CREATE INDEX IF NOT EXISTS idx_kb_entry_versions_entry
  ON kb_entry_versions (entry_id, version DESC);
