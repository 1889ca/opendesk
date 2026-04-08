# Contract: Workflow

## Purpose

Event-driven workflow definitions with a trigger/action API. Documents can have workflows that fire actions when domain events occur.

## Inputs

- `createDefinition(def)`: `CreateWorkflow` — creates a new workflow definition scoped to a document
- `getDefinition(id)`: `string` — retrieves a workflow definition by ID
- `listDefinitions(documentId)`: `string` — lists all active definitions for a document
- `updateDefinition(id, updates)`: `string, UpdateWorkflow` — patches a workflow definition
- `deleteDefinition(id)`: `string` — soft-deletes by deactivating (hard-delete from DB)
- `listExecutions(workflowId, limit?)`: `string, number` — returns execution history

## Outputs

- `WorkflowDefinition`: Full definition record with trigger/action configuration
- `WorkflowExecution`: Execution record with status, timing, and error details
- Express `Router` for REST API access to definitions and executions

## Side Effects

- Writes to `workflow_definitions` and `workflow_executions` PG tables
- Subscribes to EventBus consumer group "workflow" for trigger matching
- Executes webhook HTTP calls, export requests, and notification side effects
- Emits `WorkflowTriggered` and `WorkflowCompleted` events via EventBus

## Invariants

- Every workflow definition is scoped to exactly one document via `documentId`
- Trigger types map 1:1 to domain event types (document.updated, document.exported, grant.created, grant.revoked)
- Only active definitions are matched when events arrive
- Every action execution is recorded with status (pending, running, completed, failed)
- Failed actions record the error message but do not retry (at-least-once delivery from EventBus handles redelivery)
- Webhook actions timeout after 10 seconds
- Permission checks enforce 'manage' for create/update/delete, 'read' for list/get

## Dependencies

- `events` — EventBus for subscribing to domain events and emitting workflow lifecycle events
- `permissions` — permission middleware for route protection
- `pg` — PostgreSQL connection pool for persistence

## Boundary Rules

- MUST: scope every workflow definition to a documentId
- MUST: record every execution attempt with final status
- MUST: validate action config matches action type
- MUST: enforce permission checks on all routes
- MUST: timeout webhook calls after 10 seconds
- MUST NOT: retry failed actions (EventBus redelivery handles this)
- MUST NOT: execute workflows for inactive definitions
- MUST NOT: include document content in webhook payloads (thin events only)
- MUST NOT: block the event consumer on slow webhook calls (async execution)

## Verification

- Trigger matching → Unit test: emit a DocumentUpdated event, verify matching definitions are found and executed
- Execution recording → Unit test: run an action, verify execution row with correct status
- Webhook timeout → Unit test: mock a slow server, verify action fails after 10s
- Permission enforcement → Integration test: verify 403 for unprivileged users on manage routes
- Schema validation → Unit test: verify CreateWorkflowSchema rejects invalid trigger/action types
