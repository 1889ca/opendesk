-- Baseline schema for OpenDesk.
-- Extracted from modules/storage/internal/schema.ts + pg-search.ts.
-- All statements use IF NOT EXISTS / idempotent guards so this is safe
-- to run against databases that already have the schema.

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  yjs_state BYTEA,
  folder_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version_number INTEGER NOT NULL,
  UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS grants (
  id UUID PRIMARY KEY,
  principal_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'document',
  role TEXT NOT NULL,
  granted_by TEXT NOT NULL DEFAULT '',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_grants_principal_resource
  ON grants (principal_id, resource_id, resource_type);

CREATE TABLE IF NOT EXISTS share_links (
  token TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  grantor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search: tsvector column + GIN index
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE documents ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_search
  ON documents USING GIN (search_vector);

