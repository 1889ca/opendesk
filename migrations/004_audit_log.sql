-- Audit log: append-only HMAC-chained event record
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  document_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  action TEXT NOT NULL,
  hash TEXT NOT NULL,
  previous_hash TEXT,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_document ON audit_log (document_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log (event_id);

-- Prevent UPDATE and DELETE on audit_log (append-only)
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % operations are forbidden', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log;
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
