-- Pillar 6 M1: Sovereign Observability
-- Request metrics and system health indicators

CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY,
  correlation_id UUID NOT NULL,
  service TEXT NOT NULL DEFAULT 'api',
  operation TEXT NOT NULL,
  duration_ms REAL NOT NULL,
  status_code INTEGER,
  actor_id TEXT,
  actor_type TEXT CHECK (actor_type IN ('human', 'agent', 'system')),
  tags JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_correlation ON metrics (correlation_id);
CREATE INDEX IF NOT EXISTS idx_metrics_operation ON metrics (operation, timestamp DESC);

CREATE TABLE IF NOT EXISTS health_indicators (
  id UUID PRIMARY KEY,
  indicator_name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'critical')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_timestamp ON health_indicators (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_name ON health_indicators (indicator_name, timestamp DESC);
