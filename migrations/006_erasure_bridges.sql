-- Erasure bridges: maintain audit chain continuity across content erasures
CREATE TABLE IF NOT EXISTS erasure_bridges (
  id UUID PRIMARY KEY,
  document_id TEXT NOT NULL,
  attestation_id TEXT NOT NULL,
  pre_erasure_hash TEXT NOT NULL,
  post_erasure_hash TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  jurisdiction TEXT,
  actor_id TEXT NOT NULL,
  bridge_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erasure_bridges_document ON erasure_bridges (document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_erasure_bridges_attestation ON erasure_bridges (attestation_id);

-- Erasure bridges are append-only (same pattern as audit_log)
CREATE OR REPLACE FUNCTION erasure_bridges_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'erasure_bridges is append-only: % operations are forbidden', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_erasure_bridges_no_update ON erasure_bridges;
CREATE TRIGGER trg_erasure_bridges_no_update
  BEFORE UPDATE ON erasure_bridges
  FOR EACH ROW EXECUTE FUNCTION erasure_bridges_immutable();

DROP TRIGGER IF EXISTS trg_erasure_bridges_no_delete ON erasure_bridges;
CREATE TRIGGER trg_erasure_bridges_no_delete
  BEFORE DELETE ON erasure_bridges
  FOR EACH ROW EXECUTE FUNCTION erasure_bridges_immutable();

-- Legal holds: prevent erasure of documents under legal obligation
CREATE TABLE IF NOT EXISTS legal_holds (
  id UUID PRIMARY KEY,
  document_id TEXT NOT NULL,
  hold_type TEXT NOT NULL CHECK (hold_type IN ('litigation', 'regulatory', 'ediscovery')),
  authority TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  released_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_document ON legal_holds (document_id);
CREATE INDEX IF NOT EXISTS idx_legal_holds_active
  ON legal_holds (document_id) WHERE released_at IS NULL;
