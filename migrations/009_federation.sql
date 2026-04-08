-- Pillar 5: Cross-Sovereign Federation
-- Peer registrations and transfer records

CREATE TABLE IF NOT EXISTS federation_peers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  public_key TEXT NOT NULL,
  trust_level TEXT NOT NULL DEFAULT 'standard' CHECK (trust_level IN ('standard', 'elevated', 'restricted')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  last_seen_at TIMESTAMPTZ,
  registered_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endpoint_url)
);

CREATE TABLE IF NOT EXISTS federation_transfers (
  id UUID PRIMARY KEY,
  peer_id UUID NOT NULL REFERENCES federation_peers(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  document_id UUID NOT NULL,
  document_title TEXT,
  signature TEXT NOT NULL,
  audit_proof_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'rejected')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_federation_transfers_peer ON federation_transfers (peer_id, created_at DESC);
CREATE INDEX idx_federation_transfers_doc ON federation_transfers (document_id);
