CREATE TABLE IF NOT EXISTS collab_journal (
  id BIGSERIAL PRIMARY KEY,
  doc_id TEXT NOT NULL,
  update_binary BYTEA NOT NULL,
  sequence_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  merged BOOLEAN NOT NULL DEFAULT FALSE -- true after snapshot saved
);
CREATE INDEX IF NOT EXISTS idx_collab_journal_doc_unmerged
  ON collab_journal (doc_id, id) WHERE merged = FALSE;
