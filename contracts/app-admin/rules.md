# Contract: app-admin

## Purpose

Provide the admin observability dashboard for OpenDesk: health indicators, operation metrics, latency charts, volume charts, correlation search, and compliance export. This is a standalone HTML page (admin.html) with its own esbuild entry point.

## Inputs

- API responses from `/api/admin/health`, `/api/admin/metrics`, `/api/admin/operations`, `/api/admin/audit`
- User interactions: time range selection, search queries, export button clicks

## Outputs

- Rendered HTML dashboard with health indicators, metrics charts, operation tables
- Compliance CSV/JSON exports
- Correlation search results

## Side Effects

- HTTP requests to admin API endpoints via `@opendesk/app` apiFetch
- DOM manipulation for charts, tables, and search results

## Invariants

1. **No business logic.** Dashboard renders data from API responses only.
2. **No mock data.** Real API responses only.
3. **XSS prevention.** All user-supplied strings are escaped via `escapeHtml()`.

## Dependencies

- `@opendesk/app` (compile-time) — `apiFetch`, `initTheme`

## Boundary Rules

### MUST

- Escape all dynamic content with `escapeHtml()` before DOM insertion
- Keep every file under 200 lines
- Use modern CSS (no Tailwind)

### MUST NOT

- Import server-side modules
- Use mock data
- Exceed 200 lines per file

## File Structure

```
modules/app-admin/
  index.ts                        — Module marker (no public API)
  contract.ts                     — Module marker (no shared schemas)
  internal/
    admin-dashboard.ts            — Entry point: DOMContentLoaded init
    admin-helpers.ts              — Types and utility functions
    observability-dashboard.ts    — Main dashboard section builder
    health-panel.ts               — Health indicator rendering
    metrics-charts.ts             — Volume and latency chart rendering
    correlation-search.ts         — Log correlation search UI
    compliance-export.ts          — Compliance data export
    federation-health-panel.ts    — Federation peer health section (polls /api/federation/peers/health)
    federation-health-types.ts    — FederationPeerHealth, PingResult types + formatters
    observability-dashboard.css   — Dashboard-specific styles
    federation-health.css         — Federation health panel styles
    css/
      admin.css                   — CSS bundle entry
```

## Federation Health Panel

The federation health section is injected into the admin grid by `admin-dashboard.ts`
after the observability section. It polls `GET /api/federation/peers/health` every 30s
and renders a card per peer showing:

- Connection status (connected / disconnected / error)
- Last successful sync timestamp
- Document conflict count (all-time rejected/failed inbound)
- Failed request count (last 24h)
- Manual "Ping" action that calls `POST /api/federation/peers/:id/ping`

The section is only visible when federation peers are configured. It renders an empty
state message otherwise.
