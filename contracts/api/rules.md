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

## Invariants

- Every request is authenticated and resolved to a `Principal` before any route handler executes
- Every request body and path/query parameter is Zod-validated before being passed to any domain module
- Permission checks occur before every document operation (read, write, share, export)
- Rate limits are enforced per-principal, discriminated by `actorType`:
  - `agent`: strict token bucket (2 modifications/sec sustained, minimal burst)
  - `human`: higher burst allowance with the same sustained rate
- Agent principals connecting via WebSocket are also subject to rate limiting at the auth layer
- `GET /api/documents/:id` with `If-Match` header returns `304 Not Modified` if revision matches, or current snapshot if it does not -- this enables causal reads
- `POST /api/documents/:id/intents` returns `409 Conflict` with `currentRevision` and `currentStateVector` when the submitted revision does not match HEAD -- agents use these values to retry
- SSE replay via `Last-Event-ID` replays from the PG outbox; if the ID is older than 7 days (outbox TTL), the server returns `410 Gone` instead of silently dropping events
- No business logic lives in this module -- route handlers are pure orchestration (validate, authorize, delegate, serialize)

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

## Endpoints

| Method | Path | Description | Auth | Rate Limit |
|--------|------|-------------|------|------------|
| GET | `/api/documents` | List documents (paginated) | required | standard |
| GET | `/api/documents/:id` | Get DocumentSnapshot (supports `If-Match`) | required | standard |
| POST | `/api/documents` | Create new document | required | write |
| POST | `/api/documents/:id/intents` | Submit agent intent (OCC) | required | write (agent-strict) |
| POST | `/api/documents/:id/export` | Request export job | required | write |
| POST | `/api/documents/:id/import` | Import file | required | write |
| GET | `/api/events/stream` | SSE event stream (filterable) | required | standard |
| POST | `/api/shares` | Create share link | required | write |
| DELETE | `/api/shares/:id` | Revoke share | required | write |
| GET | `/api/templates` | List all templates | none | standard |
| POST | `/api/templates` | Create template | required | write |
| GET | `/api/templates/:id` | Get template by ID | none | standard |
| PUT | `/api/templates/:id` | Update template | required | write |
| DELETE | `/api/templates/:id` | Delete template | required | write |
| POST | `/api/upload` | Upload file (image) | none | write |
| GET | `/api/files/:key(*)` | Serve uploaded file | none | standard |
| DELETE | `/api/admin/users/:id/data` | Purge user data (self-only) | required | write |

## Sub-Contracts

- `contracts/api/templates.md` — Template CRUD endpoints (GET/POST/PUT/DELETE `/api/templates`)
- `contracts/api/uploads.md` — File upload and serving endpoints (POST `/api/upload`, GET `/api/files/*`)
- `contracts/api/admin.md` — User data purge endpoint (DELETE `/api/admin/users/:id/data`)

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
