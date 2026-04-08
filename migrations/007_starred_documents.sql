-- Starred documents table for workspace sidebar.
-- Allows users to star/unstar documents for quick access.

CREATE TABLE IF NOT EXISTS starred_documents (
  user_id TEXT NOT NULL,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  starred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_starred_documents_user
  ON starred_documents (user_id, starred_at DESC);
