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

## Trigger Types

| Trigger Type             | Domain Event             | Scoping                  |
|--------------------------|--------------------------|--------------------------|
| `document.updated`       | `DocumentUpdated`        | scoped to documentId     |
| `document.exported`      | `ExportReady`            | scoped to documentId     |
| `grant.created`          | `GrantCreated`           | scoped to documentId     |
| `grant.revoked`          | `GrantRevoked`           | scoped to documentId     |
| `document.version_created` | `DocumentVersionCreated` | scoped to documentId   |
| `kb_entity.changed`      | `KBEntityChanged`        | cross-document (all active workflows with this trigger type are evaluated) |
| `form.submitted`         | `FormSubmitted`          | cross-document (all active workflows with this trigger type are evaluated) |

## Trigger Conditions

Workflows may include an optional `triggerConditions` field — a condition tree evaluated
against fetched entity state before the workflow fires. Null means "always fire" (backward-compatible).

### Leaf condition types

| Type                 | Filter fields                                       | Notes                              |
|----------------------|-----------------------------------------------------|------------------------------------|
| `document_version`   | `versionNumber?: number`, `versionName?: string`    | At least one required; name match is case-insensitive |
| `kb_entity_change`   | `field: string`, `operator: ConditionOperator`, `value: string` | Field path is dot-notated (e.g. `content.status`) |
| `form_submission`    | `field: string`, `operator: ConditionOperator`, `value: string` | Field path into the answers map |

### Compound conditions

Use `{ operator: 'AND'|'OR', conditions: [...] }` to combine leaf or nested compound conditions.
Empty `conditions` arrays always evaluate to false.

### Known gaps (post-MVP)

- KB entity and form triggers are currently matched against **all** active workflows of that trigger type
  (cross-document). A future scoping mechanism (e.g. `workspaceId`, tag filters) is needed for
  multi-tenant deployments. The `documentId` field on these workflows is used as an ownership
  anchor only, not for event matching.
- `KBEntityChanged` and `FormSubmitted` events require the KB and Forms modules to emit these
  events on their write paths. The event type registrations exist; the emission sites are a
  post-MVP integration task tracked in the contract.
- Compound conditions with mixed leaf types (e.g. AND combining `document_version` and
  `kb_entity_change`) will silently evaluate the type-mismatched leaf as false.

## Invariants

- Every workflow definition is scoped to exactly one document via `documentId`
- Trigger types map 1:1 to domain event types (see Trigger Types table above)
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
- Trigger conditions are evaluated safely — no eval(), no code injection — using the same operator set as graph condition nodes
- Type mismatches between leaf condition type and event context evaluate to false (no cross-type fires)

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
- MUST: evaluate triggerConditions before firing a workflow (when conditions are present)
- MUST: skip workflow execution (not fail) when triggerConditions evaluate to false
- MUST NOT: fire a workflow when triggerConditions evaluation errors — log and skip instead
- MUST: return false (not throw) for type-mismatched leaf conditions in evalTriggerCondition

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
- Trigger condition — leaf: Unit test: verify document_version, kb_entity_change, form_submission leaf conditions match correctly
- Trigger condition — compound AND: Unit test: all conditions must pass for AND to return true
- Trigger condition — compound OR: Unit test: at least one condition must pass for OR to return true
- Trigger condition — nested: Unit test: (A AND B) OR C — verifies recursive evaluation
- Trigger condition — type mismatch: Unit test: applying a kb_entity_change condition to a form context returns false
- Trigger condition — skip on false: Unit test: consumer skips workflow execution when triggerConditions evaluate to false
- Trigger condition — skip on error: Unit test: consumer logs and skips when condition evaluation throws
- Cross-document trigger: Unit test: findByTriggerType returns workflows regardless of documentId
