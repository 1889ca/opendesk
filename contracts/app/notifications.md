# Contract: app/notifications

## Purpose

Provide in-app notifications with a bell icon in the top bar, unread count badge, and dropdown panel for viewing and managing notifications.

## Components

### Frontend
- `shared/notification-bell.ts` — Bell button, badge, dropdown, polling
- `shared/notification-render.ts` — Notification item rendering, badge updates
- `public/notifications.css` — Notification dropdown and item styles

### Backend
- `modules/notifications/contract.ts` — Notification types and store interface
- `modules/notifications/internal/pg-store.ts` — PostgreSQL notification store
- `modules/notifications/internal/event-subscriber.ts` — EventBus to notification converter
- `modules/api/internal/notification-routes.ts` — REST API for notifications

## Notification Types

- `comment_added` — new comment on a document
- `document_shared` — document shared with the user (from GrantCreated event)
- `workflow_triggered` — workflow was triggered (from WorkflowTriggered event)
- `kb_updated` — knowledge base entry updated

## API Routes

- `GET /api/notifications?limit=N&offset=N` — list with unread count
- `PATCH /api/notifications/:id/read` — mark one as read
- `POST /api/notifications/read-all` — mark all as read
- `DELETE /api/notifications/:id` — dismiss (delete) a notification

## Invariants

1. Unread badge polls every 30 seconds.
2. Notifications ordered by created_at DESC (newest first).
3. All notifications scoped to the authenticated user.
4. EventBus subscription auto-generates notifications from GrantCreated and WorkflowTriggered events.
5. Comment and KB notifications are created directly by their respective routes (post-MVP).

## Database

Table: `notifications` (migration 006)
- id UUID PK, user_id TEXT, type TEXT, payload JSONB, read BOOLEAN, created_at TIMESTAMPTZ

Table: `starred_documents` (migration 007)
- user_id TEXT, document_id UUID FK, starred_at TIMESTAMPTZ, PK(user_id, document_id)
