-- Knowledge Base entries with lifecycle governance and version tracking.
--
-- This migration was originally a chimera of two parallel agents'
-- CREATE TABLE statements merged into one set of parens, producing
-- `column "workspace_id" specified more than once` on every fresh
-- database. Caught by the integration test infra in #126/#127.
--
-- The unified schema supports the two live callers in
-- modules/kb/internal/:
--   - pg-entries.ts (id, workspace_id, title, body, status, version,
--     tags, metadata, created_by)
--   - entries-store.ts (id, workspace_id, entry_type, title, metadata,
--     tags, corpus, jurisdiction, created_by)
--
-- pg-kb.ts is a third file with a third schema but is unimported
-- dead code; tracked for removal in a follow-up cleanup.

CREATE TABLE IF NOT EXISTS kb_entries (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',

  -- entries-store.ts columns (with defaults so pg-entries.ts INSERTs
  -- that omit them still work)
  entry_type TEXT NOT NULL DEFAULT 'note'
    CHECK (entry_type IN ('reference', 'entity', 'dataset', 'note', 'glossary')),
  corpus TEXT NOT NULL DEFAULT 'knowledge'
    CHECK (corpus IN ('knowledge', 'operational', 'reference')),
  jurisdiction TEXT,

  -- pg-entries.ts columns
  title TEXT NOT NULL CHECK (length(title) > 0),
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'published', 'deprecated')),
  version INTEGER NOT NULL DEFAULT 1,

  -- shared columns
  tags TEXT[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_entries_workspace
  ON kb_entries (workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_entries_workspace_status
  ON kb_entries (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_entries_workspace_type
  ON kb_entries (workspace_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_kb_entries_workspace_corpus
  ON kb_entries (workspace_id, corpus);

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
