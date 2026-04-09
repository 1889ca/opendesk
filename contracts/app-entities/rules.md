# Contract: app-entities

## Purpose

Provide the entity browser UI for OpenDesk: CRUD interface for knowledge base entity objects. Standalone HTML page (entities.html) not yet integrated into the SPA shell.

## Dependencies

- `@opendesk/app` (compile-time) — `apiFetch`, `initTheme`

## File Structure

```
modules/app-entities/
  index.ts                — Module marker
  contract.ts             — Module marker
  internal/
    entity-browser.ts     — Entry point
    entity-api.ts         — API client
    entity-dialog.ts      — CRUD dialog
    entity-list-render.ts — List rendering
    content-fields.ts     — Content field components
```
