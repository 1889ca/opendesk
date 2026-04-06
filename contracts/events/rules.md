# Contract: Events

## Purpose

Typed thin event bus with guaranteed at-least-once delivery, backed by a PG transactional outbox and Redis Streams consumer groups.

## Inputs

- `emit(event: DomainEvent, pgTransaction: PgTransaction)`: Persists an event to the PG outbox within the caller's transaction, then publishes to Redis Streams after commit.
- `subscribe(consumerGroup: string, eventTypes: EventType[])`: Registers a consumer group to receive specific event types via Redis Streams.
- `acknowledge(consumerGroup: string, eventId: string)`: Marks an event as processed by a consumer group.
- `registerEventType(type: EventType, ownerModule: string)`: Registers an event type in the schema registry. Called by producing modules at startup.

## Outputs

- `DomainEvent`: Delivered to subscribers via Redis Streams consumer groups.
- `OutboxEntry[]`: Queryable outbox rows for replay (consumed by the `api` module for SSE `Last-Event-ID` replay).

### DomainEvent Base Type

```
DomainEvent:
  id:          string       // UUIDv4
  type:        EventType    // e.g. 'DocumentUpdated', 'GrantRevoked', 'StateFlushed'
  aggregateId: string       // docId, userId, etc.
  revisionId:  string       // state-vector-derived hash (for document events)
  actorId:     string
  actorType:   'human' | 'agent' | 'system'
  occurredAt:  ISOString
```

No payload field. Subscribers fetch data from storage using `aggregateId`.

### Registered Event Types

| Event Type            | Owner Module |
|-----------------------|-------------|
| `DocumentUpdated`     | collab      |
| `StateFlushed`        | collab      |
| `GrantCreated`        | sharing     |
| `GrantRevoked`        | sharing / permissions |
| `ConversionRequested` | convert     |
| `ExportReady`         | convert     |

## Side Effects

- Writes to PG outbox table -- transactional with the producing module's write (same PG transaction).
- Publishes to Redis Streams -- after the PG transaction commits.
- Prunes outbox entries older than 7 days (background job).

## Invariants

- Events are always thin: no payloads, no state vectors, no document content. The 8 KB PG NOTIFY limit makes fat events a silent pipeline killer for busy documents.
- Every event is persisted to the PG outbox before it is published to Redis Streams. If Redis publish fails, the outbox poller retries.
- Within a single `aggregateId`, events are delivered in `occurredAt` order. No ordering guarantee across different aggregate IDs.
- Every registered consumer group receives every matching event at least once. Subscribers must be idempotent.
- The outbox retains events for exactly 7 days. Replay requests for events older than 7 days are rejected with `410 Gone` (enforced by the `api` module, not this module).
- The schema registry rejects duplicate `EventType` registrations from different modules (one owner per event type).

## Dependencies

- `storage` -- provides the PG connection pool and transaction primitives used for the outbox table.

## Boundary Rules

- MUST: guarantee at-least-once delivery to all registered consumer groups.
- MUST: persist events to the PG outbox transactionally with the producing module's write.
- MUST: publish to Redis Streams after the outbox transaction commits.
- MUST: prune outbox entries older than 7 days.
- MUST: provide consumer group management (subscribe, acknowledge, replay from a given event ID).
- MUST: enforce one-owner-per-event-type in the schema registry.
- MUST NOT: include payloads, state vectors, or document content in events (thin events only).
- MUST NOT: validate event semantics beyond type registration (producers own their schemas).
- MUST NOT: guarantee ordering across different aggregate IDs.
- MUST NOT: use Redis pub/sub (use Redis Streams with consumer groups for durability and acknowledgement).
- MUST NOT: own SSE delivery to clients (that is the `api` module's responsibility).

## Verification

How to test each invariant:

- Thin events enforced --> Unit test: constructing a `DomainEvent` with extra fields beyond the base type is a type error at compile time. Integration test: assert outbox rows contain no payload column.
- Outbox-before-publish --> Integration test: emit an event, kill Redis before publish, verify the event exists in the outbox and is retried by the poller.
- Per-aggregate ordering --> Integration test: emit N events for the same `aggregateId`, verify consumer receives them in `occurredAt` order.
- At-least-once delivery --> Integration test: emit an event, do not acknowledge it, verify it is redelivered after the consumer group's pending timeout.
- 7-day TTL pruning --> Integration test: insert outbox entries with `occurredAt` older than 7 days, run the pruner, verify deletion.
- Schema registry uniqueness --> Unit test: register `DocumentUpdated` from `collab`, then attempt to register `DocumentUpdated` from `sharing`, expect rejection.
- Redis Streams (not pub/sub) --> Integration test: verify the Redis commands issued are `XADD`, `XREADGROUP`, `XACK` (not `PUBLISH`/`SUBSCRIBE`).
