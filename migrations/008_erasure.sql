-- Pillar 3: Verifiable Data Erasure
-- Erasure attestations and retention policies

CREATE TABLE IF NOT EXISTS erasure_attestations (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  reason TEXT NOT NULL,
  pre_state_hash TEXT NOT NULL,
  post_state_hash TEXT NOT NULL,
  state_changed BOOLEAN NOT NULL,
  yjs_size_before INTEGER NOT NULL,
  yjs_size_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erasure_document ON erasure_attestations (document_id);
CREATE INDEX IF NOT EXISTS idx_erasure_timestamp ON erasure_attestations (created_at DESC);

CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT '*',
  max_age_days INTEGER NOT NULL,
  auto_purge BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);
