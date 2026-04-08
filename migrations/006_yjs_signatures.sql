-- Ed25519 signing keys for Yjs update signatures
CREATE TABLE IF NOT EXISTS user_signing_keys (
  actor_id TEXT PRIMARY KEY,
  public_key_pem TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Signed Yjs update records (append-only)
CREATE TABLE IF NOT EXISTS yjs_update_signatures (
  id UUID PRIMARY KEY,
  update_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_yjs_sigs_document ON yjs_update_signatures (document_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_yjs_sigs_actor ON yjs_update_signatures (actor_id);

-- Prevent UPDATE and DELETE on yjs_update_signatures (append-only)
CREATE OR REPLACE FUNCTION yjs_sigs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'yjs_update_signatures is append-only: % operations are forbidden', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_yjs_sigs_no_update ON yjs_update_signatures;
CREATE TRIGGER trg_yjs_sigs_no_update
  BEFORE UPDATE ON yjs_update_signatures
  FOR EACH ROW EXECUTE FUNCTION yjs_sigs_immutable();

DROP TRIGGER IF EXISTS trg_yjs_sigs_no_delete ON yjs_update_signatures;
CREATE TRIGGER trg_yjs_sigs_no_delete
  BEFORE DELETE ON yjs_update_signatures
  FOR EACH ROW EXECUTE FUNCTION yjs_sigs_immutable();
