-- pgvector extension and embeddings table for AI semantic search
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('document', 'kb-entry')),
  workspace_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings (source_id, source_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_workspace ON embeddings (workspace_id);
