# Sub-Contract: app/observability-dashboard

Parent contract: `contracts/app/rules.md`

## Purpose

Admin-facing observability dashboard that surfaces telemetry from the `observability` module. Provides real-time request metrics, health indicator status, time-series charts, correlation ID search, and compliance evidence export.

## Inputs

- `MetricsSummary` from `GET /api/admin/metrics` — aggregated operations and health indicators
- `TimeSeriesPoint[]` from `GET /api/admin/metrics/timeseries` — bucketed request volume and latency over time
- `MetricEntry[]` from `GET /api/admin/metrics/search?correlationId=<uuid>` — metrics for a specific correlation ID
- User configuration: refresh interval (default 30s), time range (1h/6h/24h), endpoint/status/actor filters

## Outputs

- Rendered HTML dashboard panels: health cards, operations table, time-series charts (Canvas 2D), correlation search results
- Compliance evidence export (CSV or JSON) containing uptime, error rates, and response time summaries
- Filter state persisted to URL query params for shareability

## Components

- `observability-dashboard.ts` — main orchestrator, data fetching, auto-refresh, tab integration
- `metrics-charts.ts` — Canvas 2D time-series chart rendering (request volume + latency)
- `health-panel.ts` — health indicator cards with ok/warning/critical badges
- `correlation-search.ts` — correlation ID lookup form and result display
- `compliance-export.ts` — CSV/JSON export of compliance evidence
- `observability-dashboard.css` — all dashboard-specific styles

## Invariants

1. Charts use Canvas 2D API only — no external chart libraries.
2. All data types come from the observability module contract (`MetricEntry`, `HealthIndicator`, `MetricsSummary`, `OperationSummary`).
3. Auto-refresh interval is configurable, default 30s. Timer is cleared on unmount/tab switch.
4. No file exceeds 200 lines.
5. No mock data — test fixtures use real type shapes.
6. Dashboard is a section/tab within the existing admin page, not a separate page.

## Dependencies

- `observability` module contract types (compile-time)
- `shared/api-client.ts` — authenticated fetch
- `admin-helpers.ts` — shared formatting utilities
- `shared/theme-toggle.ts` — theme support
- API endpoints: `/api/admin/metrics`, `/api/admin/metrics/timeseries`, `/api/admin/metrics/search`

## Boundary Rules

### MUST
- Display p50/p95/p99 latencies, request counts, and error rates per endpoint
- Show health indicators with ok/warning/critical status badges
- Render time-series charts using Canvas 2D API for request volume and latency
- Support time range selection: 1h, 6h, 24h
- Support filtering by endpoint, status code, actor type
- Auto-refresh on configurable interval (default 30s)
- Provide correlation ID search
- Export compliance evidence as CSV or JSON

### MUST NOT
- Import external chart/visualization libraries
- Contain business logic — only rendering and data transformation
- Store PII or raw request bodies
- Exceed 200 lines per file

## Verification

1. **Chart data preparation** — Unit test: given raw time-series points, assert correct bucketing into chart data arrays.
2. **Percentile display** — Unit test: given an OperationSummary[], assert rendered table contains correct p50/p95/p99 values.
3. **Compliance export** — Unit test: given a MetricsSummary, assert CSV output has correct headers and values.
4. **Filter logic** — Unit test: given filters and raw data, assert correct subset is returned.
5. **Health badge rendering** — Unit test: given indicators with various statuses, assert correct CSS classes applied.
