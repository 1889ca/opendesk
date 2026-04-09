# Contract: Workflow

## Purpose

Event-driven workflow engine with visual graph editor, conditional branching, auditable execution logs, and Wasm-sandboxed plugin integrations. Documents can have workflows composed of trigger, condition, and action nodes connected in a directed graph. The `wasm_plugin` action type executes user-provided or built-in Wasm modules in a sandboxed environment with memory limits and CPU timeouts.

## Inputs

- `createDefinition(def)`: `CreateWorkflow` — creates a new workflow definition scoped to a document
- `getDefinition(id)`: `string` — retrieves a workflow definition by ID
- `listDefinitions(documentId)`: `string` — lists all active definitions for a document
- `listAllDefinitions()`: returns all active workflow definitions
- `updateDefinition(id, updates)`: `string, UpdateWorkflow` — patches a workflow definition
- `deleteDefinition(id)`: `string` — soft-deletes by deactivating (hard-delete from DB)
- `listExecutions(workflowId, limit?)`: `string, number` — returns execution history
- `getExecutionLog(executionId)`: `string` — returns detailed step-by-step execution log

## Outputs

- `WorkflowDefinition`: Full definition record with graph-based node/edge configuration
- `WorkflowExecution`: Execution record with status, timing, and error details
- `ExecutionStepLog`: Per-node evaluation record (condition results, action outcomes, duration)
- Express `Router` for REST API access to definitions, executions, and step logs

## Side Effects

- Writes to `workflow_definitions`, `workflow_executions`, `workflow_execution_steps`, and `wasm_plugins` PG tables
- Subscribes to EventBus consumer group "workflow" for trigger matching
- Executes webhook HTTP calls, export requests, notification side effects, metadata updates, folder moves, status changes, email sends, and Wasm plugin invocations
- Emits `WorkflowTriggered` and `WorkflowCompleted` events via EventBus
- Seeds built-in Wasm plugins (text-transformer, json-validator, word-counter) on startup

## Invariants

- Every workflow definition is scoped to exactly one document via `documentId`
- Trigger types map 1:1 to domain event types (document.updated, document.exported, grant.created, grant.revoked)
- Only active definitions are matched when events arrive
- Every action execution is recorded with status (pending, running, completed, failed)
- Every node evaluation is recorded as an execution step with input/output and duration
- Failed actions record the error message but do not retry (at-least-once delivery from EventBus handles redelivery)
- Webhook actions timeout after 10 seconds
- Wasm plugin executions are sandboxed: 16MB memory limit, 5s CPU timeout, no filesystem or network access
- Wasm plugin output is merged into event context for downstream nodes (keyed by `node_<id>`)
- Built-in plugins use native JS executors; user-uploaded plugins run in WebAssembly sandbox
- Compiled Wasm modules are cached in memory for performance
- Condition nodes produce boolean results that determine which branch to follow
- Parallel split nodes execute all outgoing branches concurrently
- Permission checks enforce 'manage' for create/update/delete, 'read' for list/get

## Dependencies

- `events` — EventBus for subscribing to domain events and emitting workflow lifecycle events
- `permissions` — permission middleware for route protection
- `pg` — PostgreSQL connection pool for persistence

## Boundary Rules

- MUST: scope every workflow definition to a documentId
- MUST: record every execution attempt with final status
- MUST: record every node evaluation as an execution step
- MUST: validate action config matches action type
- MUST: enforce permission checks on all routes
- MUST: timeout webhook calls after 10 seconds
- MUST: evaluate condition expressions safely (no eval, no code injection)
- MUST NOT: retry failed actions (EventBus redelivery handles this)
- MUST NOT: execute workflows for inactive definitions
- MUST NOT: include document content in webhook payloads (thin events only)
- MUST NOT: block the event consumer on slow webhook calls (async execution)
- MUST: validate Wasm binaries with WebAssembly.validate before storing
- MUST: enforce memory and timeout limits on all Wasm executions
- MUST: prevent built-in plugins from being deleted
- MUST NOT: give Wasm modules access to host functions, filesystem, or network

## Verification

- Trigger matching: Unit test: emit a DocumentUpdated event, verify matching definitions are found and executed
- Execution recording: Unit test: run an action, verify execution row with correct status
- Step logging: Unit test: run a workflow with conditions, verify step rows with correct input/output
- Webhook timeout: Unit test: mock a slow server, verify action fails after 10s
- Condition evaluation: Unit test: verify field comparisons, role checks, and metadata checks
- Branching: Unit test: verify if/else branches follow correct path based on condition result
- Parallel execution: Unit test: verify split nodes execute all branches
- Permission enforcement: Integration test: verify 403 for unprivileged users on manage routes
- Schema validation: Unit test: verify CreateWorkflowSchema rejects invalid trigger/action types
