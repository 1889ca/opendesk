-- Reference library and document citation tracking.
-- All statements use IF NOT EXISTS / idempotent guards.

CREATE TABLE IF NOT EXISTS references (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_references_workspace_doi
  ON references (workspace_id, doi) WHERE doi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_references_workspace
  ON references (workspace_id);

CREATE TABLE IF NOT EXISTS document_citations (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES references(id) ON DELETE CASCADE,
  locator TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, reference_id)
);
