# Contract: API

## Purpose

HTTP boundary layer that exposes REST endpoints for document CRUD, sharing, export/import, and SSE event observation -- pure orchestration with no business logic.

## Inputs

- `req.body`: `unknown` — raw request body, validated with Zod before forwarding to domain modules
- `req.params.id`: `string` — document or share identifier from URL path
- `req.headers['authorization']`: `string` — bearer token resolved to a `Principal` via auth middleware
- `req.headers['if-match']`: `string | undefined` — optional `revisionId` for causal reads on `GET /api/documents/:id`
- `req.headers['last-event-id']`: `string | undefined` — SSE replay cursor for `GET /api/events/stream`
- `req.query.types[]`: `string[]` — optional event type filter for SSE stream
- `req.query.page`, `req.query.limit`: `number` — pagination parameters for list endpoints

## Outputs

- `200 OK` + `DocumentSnapshot` — successful document read (includes `revisionId` in `ETag` header)
- `200 OK` + `Document[]` — paginated document list
- `201 Created` + `Document` — successful document creation
- `202 Accepted` + `{ intentId }` — intent submitted to IntentExecutor
- `202 Accepted` + `{ jobId }` — export/import job queued
- `201 Created` + `ShareLink` — share link created
- `204 No Content` — share revoked
- `text/event-stream` — SSE connection with `id`, `event`, `data` fields per message
- `400 Bad Request` + `ZodError` — input validation failure (serialized Zod issues array)
- `401 Unauthorized` — missing or invalid authentication
- `403 Forbidden` — principal lacks required permission
- `404 Not Found` — resource does not exist
- `409 Conflict` + `{ currentRevision, currentStateVector }` — OCC conflict on intent submission
- `410 Gone` — SSE `Last-Event-ID` is older than outbox TTL (7 days)
- `429 Too Many Requests` + `Retry-After` header — rate limit exceeded

## Side Effects

- Delegates WebSocket upgrade requests to collab module's Hocuspocus handler (mounted on the same HTTP server)
- Triggers export/import jobs via the convert module
- Writes share grants via the sharing module
- Opens long-lived SSE connections via the events module

## Invariants (current)

- Every request is authenticated and resolved to a `Principal` before any route handler executes
- Every request body and path/query parameter is Zod-validated before being passed to any domain module
- Permission checks occur before every document operation (read, write, share, export)
- No business logic lives in this module -- route handlers are pure orchestration (validate, authorize, delegate, serialize)

## Planned Invariants (post-MVP)

- Rate limits enforced per-principal, discriminated by `actorType` (agent: 2/sec strict, human: higher burst)
- Agent principals connecting via WebSocket also subject to rate limiting at the auth layer
- `GET /api/documents/:id` with `If-Match` header returns `304 Not Modified` if revision matches (causal reads)
- `POST /api/documents/:id/intents` returns `409 Conflict` with `currentRevision` and `currentStateVector` on stale revision
- SSE replay via `Last-Event-ID` replays from the PG outbox; IDs older than 7 days return `410 Gone`

## Dependencies

- `auth` — provides authentication middleware; resolves bearer tokens to `Principal` objects with `actorType` discrimination
- `permissions` — authorization checks called before every document operation
- `document` — owns Zod schemas for document-related inputs; api imports these for validation
- `collab` — provides the Hocuspocus WebSocket upgrade handler (mounted by api) and `IntentExecutor` (called for intent submission)
- `events` — provides SSE stream factory; api opens connections and manages `Last-Event-ID` replay logic
- `sharing` — grant creation and revocation logic for share endpoints
- `convert` — export and import job submission
- `storage` — read-only document access for GET endpoints

## Boundary Rules

- MUST: validate ALL inputs (body, params, query) with Zod schemas from the `document` module before passing to any domain module
- MUST: authenticate every request via `auth` middleware and resolve to a `Principal`
- MUST: check permissions via `permissions` module before any document operation
- MUST: discriminate rate limits by `principal.actorType` (human vs agent) using token bucket algorithm
- MUST: include `ETag` header with `revisionId` on document read responses
- MUST: return `409 Conflict` with `currentRevision` + `currentStateVector` on OCC failures
- MUST: return `410 Gone` for SSE `Last-Event-ID` values older than outbox TTL (7 days)
- MUST: mount collab's WebSocket upgrade handler on the same HTTP server instance
- MUST: return structured error responses (Zod issues for 400, machine-readable codes for 4xx/5xx)
- MUST NOT: implement business logic -- this module is pure routing and orchestration
- MUST NOT: access storage directly for writes -- all mutations go through domain modules (`document`, `sharing`, `convert`)
- MUST NOT: parse, inspect, or manipulate Yjs binary data -- that is collab's responsibility
- MUST NOT: hold document state in memory -- all state lives in storage and collab

## Endpoints owned by this module

The api module itself owns only the api-layer infrastructure routes
(admin/upload/file/health). Domain routes that used to live here
have been migrated to their owning modules under
`modules/<name>/manifest.ts`; see "Routes contributed by other
modules" below for the full mapping.

| Method | Path | Description | Auth | Rate Limit |
|--------|------|-------------|------|------------|
| GET | `/api/health` | Liveness check (DB ping) | none | standard |
| POST | `/api/upload` | Upload file (image) | none | write |
| GET | `/api/files/:key(*)` | Serve uploaded file | none | standard |
| DELETE | `/api/admin/users/:id/data` | Purge user data (self-only) | required | write |

These are declared in `modules/api/manifest.ts` and registered
through the manifest registry like every other module.

## Routes contributed by other modules

The composition root no longer hand-mounts feature routes. Each
module declares its routes via `modules/<name>/manifest.ts` and
the manifest registry walks them all in one shot. The current
mapping (as of the manifest migration):

| Mount | Owning module | Manifest |
|-------|---------------|----------|
| `/api/documents` (CRUD/search/version/export/move) + `/api/folders` + `/api/starred` + `/api/search` | document | `modules/document/manifest.ts` |
| `/api/templates` | storage | `modules/storage/manifest.ts` |
| `/api/documents/:id/convert-*` + `/api/sheets/:id/{import,export}` + `/api/presentations/:id/convert-*` | convert | `modules/convert/manifest.ts` |
| `/api/kb` (full Knowledge Base surface) | kb | `modules/kb/manifest.ts` |
| `/api/references` (CRUD + BibTeX/RIS import/export) | references | `modules/references/manifest.ts` |
| `/api/notifications` | notifications | `modules/notifications/manifest.ts` |
| `/api/audit` | audit | `modules/audit/manifest.ts` |
| `/api/workflows` + `/api/workflows/plugins` | workflow | `modules/workflow/manifest.ts` |
| `/api/erasure` | erasure | `modules/erasure/manifest.ts` |
| `/api/federation` (gated) | federation | `modules/federation/manifest.ts` |
| `/api/ai` (gated, lifecycle-managed consumer) | ai | `modules/ai/manifest.ts` |
| `/api/admin/metrics` | observability | `modules/observability/manifest.ts` |
| `/api/share/*` (still hand-mounted — restricted zone per CONSTITUTION.md) | sharing | (manual) |

The registration system itself is documented in
`contracts/core/manifest/rules.md`.

## Sub-Contracts

- `contracts/api/uploads.md` — File upload and serving endpoints (POST `/api/upload`, GET `/api/files/*`)
- `contracts/api/admin.md` — User data purge endpoint (DELETE `/api/admin/users/:id/data`)
- `contracts/api/templates.md` — Template CRUD endpoints (now owned by storage; sub-contract retained for the wire format)

## Verification

- **Authentication invariant** -> Integration test: send requests without auth header, with expired token, with valid token; assert 401/200 respectively
- **Zod validation invariant** -> Unit test: send malformed bodies to each POST endpoint; assert 400 with Zod issues array in response
- **Permission check invariant** -> Integration test: send requests from principals lacking required permissions; assert 403
- **Rate limiting invariant** -> Integration test: send burst of agent-typed requests exceeding 2/sec; assert 429 with `Retry-After` header; repeat with human-typed principal at same rate; assert no 429
- **Causal read invariant** -> Integration test: create document, note revisionId, send GET with `If-Match: <revisionId>`; assert 304; mutate document, resend same GET; assert 200 with new snapshot
- **OCC conflict invariant** -> Integration test: submit intent with stale revisionId; assert 409 with `currentRevision` and `currentStateVector` in body
- **SSE replay invariant** -> Integration test: connect to SSE with valid `Last-Event-ID`; assert replayed events; connect with ID older than 7 days; assert 410 Gone
- **No business logic invariant** -> Code review rule: route handlers must contain only validation, auth, permission check, delegation call, and response serialization -- no domain logic
- **WebSocket upgrade** -> Integration test: send HTTP upgrade request to collab path; assert 101 Switching Protocols and handoff to Hocuspocus

## MVP Scope

Implemented:
- [x] REST endpoints for document CRUD (GET/POST /api/documents, GET /api/documents/:id)
- [x] Authentication middleware resolving bearer tokens to `Principal`
- [x] Permission checks before document operations
- [x] WebSocket upgrade delegation to collab module's Hocuspocus handler
- [x] Structured error responses (401, 403, 404)
- [x] No business logic in route handlers (pure orchestration)
- [x] Share link endpoints (POST /api/documents/:id/share, POST /api/share/:token/resolve, DELETE /api/share/:token)
- [x] Export/import via Collabora (POST /api/documents/:id/convert-export, POST /api/documents/:id/convert-import)
- [x] Template CRUD endpoints (see `contracts/api/templates.md`)
- [x] File upload and serving endpoints (see `contracts/api/uploads.md`)
- [x] Admin user data purge endpoint (see `contracts/api/admin.md`)
- [x] Zod validation on document CRUD request bodies (POST, PATCH /api/documents)
- [x] Zod validation on template CRUD request bodies (POST, PUT /api/templates)
- [x] Zod validation on upload request body (POST /api/upload)

Post-MVP (deferred):
- [ ] Zod validation on remaining request bodies (intents, export/import params)
- [ ] Rate limiting per-principal with actorType discrimination (human vs agent token bucket)
- [ ] `ETag` / `If-Match` header support for causal reads (304 Not Modified)
- [ ] SSE event stream endpoint (GET /api/events/stream) — requires events module implementation
- [ ] Intent submission endpoint (POST /api/documents/:id/intents) — requires collab IntentExecutor
- [ ] `410 Gone` for expired SSE Last-Event-ID — requires events module
- [ ] Pagination parameters (page, limit) on list endpoints
