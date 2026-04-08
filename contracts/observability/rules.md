# Contract: Observability

## Purpose

Unified cross-type telemetry collection, anomaly detection, drill-down forensics, and SIEM export for the OpenDesk platform.

## Inputs

- `MetricSample`: `{ metric, contentType, value, timestamp }` — a single telemetry data point
- `AnomalyAlert`: `{ metric, value, threshold, severity }` — detected anomaly
- `ForensicsQuery`: `{ contentType?, actorId?, action?, from?, to? }` — drill-down filter
- `SiemConfig`: `{ format, endpoint?, filters? }` — SIEM export configuration

## Outputs

- `TimeSeriesBucket[]` — aggregated metric data for dashboard rendering
- `AnomalyAlert[]` — list of detected anomalies with severity
- `ForensicsEvent[]` — correlated events for drill-down view
- `string` — formatted SIEM export (CEF, syslog RFC 5424, JSON lines)

## Side Effects

- Writes metric samples to PostgreSQL `metric_samples` table
- Writes anomaly alerts to PostgreSQL `anomaly_alerts` table
- Pushes SIEM data to configured external endpoints (webhook/syslog)

## Invariants

- Every metric sample must include a valid `contentType` dimension
- Anomaly detection uses rolling 1-hour window for Z-score calculation
- Rate-of-change detection uses 5-minute windows
- Z-score threshold is 3 standard deviations
- Rate-of-change threshold is 200% increase
- SIEM export formats must comply with CEF, RFC 5424, or JSON lines specs
- All timestamps are ISO 8601 UTC

## Dependencies

- `events` — subscribes to domain events for metric derivation
- `audit` — correlates audit entries in forensics drill-down
- `storage` — PostgreSQL pool for persistence
- `logger` — structured logging

## Boundary Rules

- MUST: validate all metric names against a known registry
- MUST: include contentType on every metric sample
- MUST: support cursor-based pagination on all list endpoints
- MUST NOT: store raw event payloads in metric samples (only derived values)
- MUST NOT: expose SIEM credentials in API responses

## Verification

- Z-score detection flags values > 3 SD from rolling mean -> property-based test with synthetic data
- Rate-of-change detection flags > 200% spike -> unit test with known spike pattern
- CEF format output matches spec -> snapshot test against known-good CEF string
- Syslog output matches RFC 5424 -> regex validation test
- Forensics query returns only events matching all filters -> integration test
