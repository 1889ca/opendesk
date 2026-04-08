# Contract: audit

## Purpose

Append-only HMAC-chained audit log recording all domain events. Provides tamper-evident history for every document with cryptographic chain verification.

## Inputs

- `DomainEvent` (from `events`) -- Thin domain events received via EventBus consumer group "audit".
- `documentId` -- Derived from `event.aggregateId`.
- `hmacSecret` -- Symmetric key used for HMAC-SHA256 hash computation.
- `cursor` -- Optional UUID for cursor-based pagination of audit log queries.
- `limit` -- Optional number (default 50, max 200) for pagination.

## Outputs

- `AuditEntry`: `{ id: UUID, eventId: UUID, documentId: string, actorId: string, actorType: 'human' | 'agent' | 'system', action: string, hash: string (hex), previousHash: string | null (hex), occurredAt: ISO string }` -- A single audit log entry with its HMAC hash and chain link.
- `AuditVerifyResult`: `{ documentId: string, totalEntries: number, verified: boolean, brokenAtId: UUID | null }` -- Result of verifying the HMAC chain for a document.

## Side Effects

- Inserts rows into `audit_log` table (append-only, never updated or deleted).
- Subscribes to ALL event types via EventBus consumer group "audit".

## Invariants

- No UPDATE or DELETE on the `audit_log` table. A PostgreSQL trigger enforces this at the database level, raising an exception on any UPDATE or DELETE attempt.
- Each entry's HMAC-SHA256 hash includes the previous entry's hash (per-document chain). The first entry in a document's chain has `previousHash = null` (empty string used in HMAC computation).
- The HMAC input is the pipe-delimited concatenation: `eventId|documentId|actorId|action|occurredAt|previousHash`.
- Chain is verifiable from any point: recompute each hash from its fields + previous hash and compare.
- The consumer group name is always "audit".
- Audit entries are never modified after creation.

## Dependencies

- `events` -- Provides `EventBusModule` for subscribing to domain events.
- `permissions` -- Used by audit routes to enforce owner-level access on audit log queries.
- `config` -- Provides `hmacSecret` for HMAC computation.

## Boundary Rules

- MUST: Record every domain event as an audit entry with HMAC chain.
- MUST: Subscribe to ALL event types via the "audit" consumer group.
- MUST: Enforce append-only semantics via PG trigger (no UPDATE/DELETE).
- MUST: Compute HMAC-SHA256 using the canonical pipe-delimited format.
- MUST: Link each entry to the previous entry's hash for the same document.
- MUST: Support cursor-based pagination for log queries.
- MUST: Support full chain verification per document.
- MUST NOT: Update or delete audit entries.
- MUST NOT: Store event payloads (events are thin).
- MUST NOT: Bypass the EventBus subscription model.

## Verification

- HMAC chain integrity: Create 3+ entries for a document, verify chain links. Tamper with one entry's field, verify chain reports broken.
- Append-only enforcement: Attempt UPDATE and DELETE on `audit_log` table, assert PG exception raised.
- Schema validation: Parse valid and invalid `AuditEntry` objects through Zod schemas, assert correct acceptance/rejection.
- Cursor pagination: Insert entries, query with cursor, assert correct subset returned in correct order.

## Pillar 2 M2: Point-in-Time Verifiability

Implemented:
- [x] Full audit proof export (chain + metadata + verification status)
- [x] Lightweight proof summary (anchor/head hashes, counts, time range)
- [x] Offline proof verification (no DB needed, just proof bundle + HMAC secret)
- [x] API endpoints: GET /proof/:documentId, GET /proof/:documentId/summary, POST /proof/verify
- [x] 5 tests covering valid chains, tampered entries, broken links, wrong secrets, empty chains
## MVP Scope

Implemented:
- [x] HMAC-SHA256 chain computation and verification
- [x] Append-only audit_log table with PG trigger
- [x] EventBus consumer subscribing to all event types
- [x] Cursor-based log pagination
- [x] Chain verification endpoint
- [x] Permission-gated API routes (owner only)
