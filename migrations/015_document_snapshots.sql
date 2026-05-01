-- Migration 015: atomic snapshot + state vector co-persistence
-- Adds snapshot JSONB, revision_id, and state_vector columns to documents.
-- These three fields are always written in a single transaction by
-- pg-document-repository.ts (saveSnapshot). Querying revision_id enables
-- optimistic-concurrency checks without loading the full binary.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS snapshot       JSONB,
  ADD COLUMN IF NOT EXISTS revision_id    TEXT,
  ADD COLUMN IF NOT EXISTS state_vector   BYTEA;

-- Fast lookup by revision for optimistic-concurrency checks
CREATE INDEX IF NOT EXISTS documents_revision_id_idx ON documents (revision_id)
  WHERE revision_id IS NOT NULL;
