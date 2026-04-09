# Contract: notifications

## Purpose

Provide in-app notifications for OpenDesk users. Generates notifications from EventBus domain events and exposes CRUD operations for listing, reading, and dismissing notifications.

## Inputs

- Domain events from the EventBus (comment added, document shared, workflow triggered, KB entry updated)
- API requests for listing, marking read, and dismissing notifications

## Outputs

- Notification records stored in PostgreSQL
- API responses with notification lists and mutation confirmations

## Invariants

1. Every notification has a user_id, type, payload, read flag, and created_at timestamp.
2. Notification types are: `comment_added`, `document_shared`, `workflow_triggered`, `kb_updated`.
3. Notifications are ordered by created_at DESC (newest first).
4. Mark-all-as-read updates all unread notifications for the requesting user.

## Dependencies

- `storage` (runtime) — PostgreSQL pool for persistence
- `events` (runtime) — EventBus subscription for generating notifications from domain events

## Boundary Rules

### MUST
- Store notifications in PostgreSQL `notifications` table
- Subscribe to relevant EventBus event types to auto-generate notifications
- Support pagination via limit/offset

### MUST NOT
- Import any frontend module
- Send push notifications (post-MVP)
