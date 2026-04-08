-- Event outbox for transactional event publishing
CREATE TABLE IF NOT EXISTS event_outbox (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  revision_id TEXT,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  occurred_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ
);

-- Efficient polling for unpublished events
CREATE INDEX IF NOT EXISTS idx_event_outbox_unpublished
  ON event_outbox (occurred_at) WHERE published_at IS NULL;

-- Per-aggregate ordering for event delivery
CREATE INDEX IF NOT EXISTS idx_event_outbox_aggregate
  ON event_outbox (aggregate_id, occurred_at);

-- Schema registry: one owner per event type
CREATE TABLE IF NOT EXISTS event_type_registry (
  type TEXT PRIMARY KEY,
  owner_module TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
