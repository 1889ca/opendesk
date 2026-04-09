# Contract: observability

## Purpose

Sovereign observability pipeline — captures HTTP request telemetry, system health indicators, and correlation IDs across the full request lifecycle. Provides a /api/admin/metrics endpoint for real-time compliance evidence and operational visibility.

## Inputs

- HTTP requests (via Express middleware) — method, path, status, duration, actor
- `correlationId` — propagated via `X-Correlation-ID` header or auto-generated UUID
- System probes — PG pool stats, Redis ping latency, process memory/uptime

## Outputs

- `MetricEntry`: `{ id, correlationId, service, operation, durationMs, statusCode, actorId, actorType, tags, timestamp }` — A single request metric.
- `HealthIndicator`: `{ name, value, unit, status, timestamp }` — A point-in-time health probe result (ok/warning/critical).
- `MetricsSummary`: Aggregated view of recent metrics (counts, p50/p95/p99 latencies) and current health indicators.

## Side Effects

- Inserts rows into `metrics` table on every sampled HTTP request.
- Inserts rows into `health_indicators` table on each health probe cycle.
- Sets `X-Correlation-ID` response header on every request.

## Invariants

- Correlation ID is always a valid UUIDv4 (generated if not present on request).
- Health probes never throw — failures are recorded as status: 'critical' with value -1.
- Metrics insertion failures are logged but never crash the request pipeline.
- The telemetry middleware never adds latency >1ms to request processing (fire-and-forget writes).
- Health probe interval is configurable, default 60s.

## Dependencies

- `config` — Provides observability settings (enabled, sampleRate, healthIntervalMs).
- `logger` — Structured logging for internal errors.
- `storage` (PG pool) — For metrics and health indicator storage.

## Boundary Rules

- MUST: Propagate correlation ID through every request.
- MUST: Record HTTP method, path, status code, duration, actor on sampled requests.
- MUST: Run health probes on a configurable interval.
- MUST: Expose `/api/admin/metrics` behind admin auth.
- MUST NOT: Store PII in metric tags (no request bodies, no query params with user data).
- MUST NOT: Block request processing on metric writes.
- MUST NOT: Instrument internal observability writes (no infinite telemetry loops).

## Verification

- Correlation ID propagation: Send request without X-Correlation-ID, assert response has one. Send with one, assert same returned.
- Metric recording: Send request, query metrics table, assert entry exists with correct fields.
- Health probes: Start monitor, wait one interval, query health_indicators, assert entries exist.
- Error resilience: Mock PG failure on metric insert, assert request still succeeds.
- Sample rate: Set rate to 0, send requests, assert no metrics recorded. Set to 1, assert all recorded.
# Contract: Observability
Unified cross-type telemetry collection, anomaly detection, drill-down forensics, and SIEM export for the OpenDesk platform.
- `MetricSample`: `{ metric, contentType, value, timestamp }` — a single telemetry data point
- `AnomalyAlert`: `{ metric, value, threshold, severity }` — detected anomaly
- `ForensicsQuery`: `{ contentType?, actorId?, action?, from?, to? }` — drill-down filter
- `SiemConfig`: `{ format, endpoint?, filters? }` — SIEM export configuration
- `TimeSeriesBucket[]` — aggregated metric data for dashboard rendering
- `AnomalyAlert[]` — list of detected anomalies with severity
- `ForensicsEvent[]` — correlated events for drill-down view
- `string` — formatted SIEM export (CEF, syslog RFC 5424, JSON lines)
- Writes metric samples to PostgreSQL `metric_samples` table
- Writes anomaly alerts to PostgreSQL `anomaly_alerts` table
- Pushes SIEM data to configured external endpoints (webhook/syslog)
- Every metric sample must include a valid `contentType` dimension
- Anomaly detection uses rolling 1-hour window for Z-score calculation
- Rate-of-change detection uses 5-minute windows
- Z-score threshold is 3 standard deviations
- Rate-of-change threshold is 200% increase
- SIEM export formats must comply with CEF, RFC 5424, or JSON lines specs
- All timestamps are ISO 8601 UTC
- `events` — subscribes to domain events for metric derivation
- `audit` — correlates audit entries in forensics drill-down
- `storage` — PostgreSQL pool for persistence
- `logger` — structured logging
- MUST: validate all metric names against a known registry
- MUST: include contentType on every metric sample
- MUST: support cursor-based pagination on all list endpoints
- MUST NOT: store raw event payloads in metric samples (only derived values)
- MUST NOT: expose SIEM credentials in API responses
- Z-score detection flags values > 3 SD from rolling mean -> property-based test with synthetic data
- Rate-of-change detection flags > 200% spike -> unit test with known spike pattern
- CEF format output matches spec -> snapshot test against known-good CEF string
- Syslog output matches RFC 5424 -> regex validation test
- Forensics query returns only events matching all filters -> integration test
