-- Pending grants table for the invite-by-email workflow (#311).
--
-- A pending grant is created when a document owner invites someone by email.
-- The grantee_id is null until the invitee authenticates, at which point the
-- grant is activated: status transitions to 'active' and grantee_id is filled.
--
-- Status transitions are one-directional: pending -> active -> revoked.
-- A revoked grant is never reactivated.

CREATE TABLE IF NOT EXISTS pending_grants (
  id            UUID PRIMARY KEY,
  doc_id        TEXT NOT NULL,
  grantor_id    TEXT NOT NULL,
  grantee_email TEXT NOT NULL,
  grantee_id    TEXT,           -- null until activated
  role          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'revoked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_grants_email_status
  ON pending_grants (grantee_email, status);

CREATE INDEX IF NOT EXISTS idx_pending_grants_doc
  ON pending_grants (doc_id);
