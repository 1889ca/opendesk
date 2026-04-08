-- Observability module schema
-- Tables: metric_samples, anomaly_alerts, forensics_events, siem_configs

CREATE TABLE IF NOT EXISTS metric_samples (
  id          BIGSERIAL PRIMARY KEY,
  metric      VARCHAR(100) NOT NULL,
  content_type VARCHAR(20) NOT NULL,
  value       DOUBLE PRECISION NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_metric_samples_metric_ts
  ON metric_samples (metric, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_metric_samples_content_type
  ON metric_samples (content_type, timestamp DESC);

CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id              UUID PRIMARY KEY,
  metric          VARCHAR(100) NOT NULL,
  content_type    VARCHAR(20) NOT NULL,
  value           DOUBLE PRECISION NOT NULL,
  threshold       DOUBLE PRECISION NOT NULL,
  severity        VARCHAR(20) NOT NULL,
  detection_type  VARCHAR(30) NOT NULL,
  message         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_severity
  ON anomaly_alerts (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_unacknowledged
  ON anomaly_alerts (created_at DESC) WHERE acknowledged_at IS NULL;

CREATE TABLE IF NOT EXISTS forensics_events (
  id           UUID PRIMARY KEY,
  event_type   VARCHAR(100) NOT NULL,
  content_type VARCHAR(20) NOT NULL,
  actor_id     VARCHAR(255) NOT NULL,
  actor_type   VARCHAR(20) NOT NULL,
  action       VARCHAR(100) NOT NULL,
  resource_id  VARCHAR(255) NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_forensics_events_actor
  ON forensics_events (actor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_forensics_events_content_type
  ON forensics_events (content_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_forensics_events_occurred_at
  ON forensics_events (occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS siem_configs (
  id         UUID PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  format     VARCHAR(20) NOT NULL,
  mode       VARCHAR(10) NOT NULL,
  endpoint   TEXT,
  filters    JSONB NOT NULL DEFAULT '{}',
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
