-- Reference library and document citation tracking.
-- All statements use IF NOT EXISTS / idempotent guards.
--
-- The table was originally named `references` (without quotes) but
-- `references` is a reserved word in PostgreSQL — the migration would
-- fail with `syntax error at or near "references"` on every fresh
-- database. The matching application code in
-- modules/references/internal/pg-references.ts had the same bug, so
-- the feature has never actually run end-to-end against real PG.
-- Caught by the integration test infra in #126/#127.
--
-- Renamed to `reference_entries`. Since the migration was broken,
-- there is no production data in the original table to migrate.

CREATE TABLE IF NOT EXISTS reference_entries (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  type TEXT NOT NULL DEFAULT 'article-journal',
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]',
  issued_date TEXT,
  container_title TEXT,
  volume TEXT,
  issue TEXT,
  pages TEXT,
  doi TEXT,
  url TEXT,
  isbn TEXT,
  abstract TEXT,
  publisher TEXT,
  language TEXT DEFAULT 'en',
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique DOI per workspace, partial index (only non-null DOIs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reference_entries_workspace_doi
  ON reference_entries (workspace_id, doi) WHERE doi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reference_entries_workspace
  ON reference_entries (workspace_id);

CREATE TABLE IF NOT EXISTS document_citations (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES reference_entries(id) ON DELETE CASCADE,
  locator TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, reference_id)
);
