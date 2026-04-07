# Templates Contract

## Purpose

CRUD endpoints and storage for document templates, including a set of built-in default templates (Blank, Meeting Notes, Project Brief, Report).

## Inputs / Outputs

**Endpoints:**

| Method | Path | Auth | Input | Output |
|--------|------|------|-------|--------|
| GET | `/api/templates` | none | — | `TemplateRow[]` |
| POST | `/api/templates` | required | `{ name, description?, content? }` | `201` + `TemplateRow` |
| GET | `/api/templates/:id` | none | — | `TemplateRow` or `404` |
| PUT | `/api/templates/:id` | required | `{ name?, description?, content? }` | `TemplateRow` or `404` |
| DELETE | `/api/templates/:id` | required | — | `{ ok: true }` or `404` |

**TemplateRow schema:**
- `id`: UUID (server-generated via `randomUUID`)
- `name`: TEXT, required
- `description`: TEXT, defaults to `''`
- `content`: JSONB (ProseMirror document JSON), defaults to `{}`
- `created_at`, `updated_at`: TIMESTAMPTZ

## Invariants

- MUST: require authentication for create, update, and delete operations
- MUST: generate template `id` server-side (UUID v4), never accept client-supplied IDs
- MUST: validate that `name` is present on creation (400 if missing)
- MUST: return templates ordered by `created_at ASC` on list
- MUST: set `updated_at = NOW()` on every update
- MUST NOT: allow unauthenticated users to create, modify, or delete templates
- MUST NOT: contain business logic in route handlers — delegates to storage module

## Default Templates

Four built-in templates seeded as ProseMirror JSON:
- **Blank** — empty paragraph
- **Meeting Notes** — headings for date, attendees, agenda, discussion, action items
- **Project Brief** — headings for overview, goals, scope, timeline, team
- **Report** — headings for executive summary, introduction, methodology, findings, conclusion

## Dependencies

- `storage` — `templates.ts` for CRUD operations, `default-templates.ts` for seed data
- `permissions` — `requireAuth` middleware for write operations

## Verification

- Unit test: POST without `name` returns 400
- Unit test: GET `/api/templates` returns array sorted by `created_at`
- Integration test: full CRUD cycle (create, read, update, delete)
- Unit test: unauthenticated POST/PUT/DELETE returns 401

## MVP Scope

Implemented:
- [x] Full CRUD endpoints (list, create, get, update, delete)
- [x] PostgreSQL storage with JSONB content column
- [x] Four default templates with ProseMirror JSON content
- [x] Auth-gated write operations
- [x] Server-generated UUIDs
