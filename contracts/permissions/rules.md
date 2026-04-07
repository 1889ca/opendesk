# Contract: permissions

## Purpose

Evaluate access control decisions as pure functions: given a `Principal`, an action, and a resource, determine whether access is granted based on the set of `Grant` records, and manage the lifecycle of those grants.

## Inputs

- `principal`: `Principal` (from `auth`) -- The identity requesting access.
- `query`: `PermissionQuery: { principalId: string, action: Action, resourceId: string, resourceType: string }` -- A request to evaluate whether a specific action is allowed on a specific resource.
- `grants`: `Grant[]` -- The set of grants to evaluate against. Loaded from storage before evaluation; never fetched during evaluation.
- `grantDef`: `{ principalId: string, resourceId: string, resourceType: string, role: Role, grantedBy: string, expiresAt?: string }` -- Definition for creating a new grant.

## Outputs

- `Grant`: `{ id: string, principalId: string, resourceId: string, resourceType: string, role: Role, grantedBy: string, grantedAt: string, expiresAt?: string }` -- A single access control entry linking a principal to a resource at a specific role.
- `Role`: `'owner' | 'editor' | 'commenter' | 'viewer'` -- The four roles, ordered by descending privilege: owner > editor > commenter > viewer.
- `PermissionResult`: `{ allowed: boolean, role: Role | null, grant: Grant | null, reason: string }` -- The outcome of a permission evaluation. Always includes a human-readable `reason` explaining why access was granted or denied.
- `Action`: `'read' | 'write' | 'comment' | 'delete' | 'share' | 'manage'` -- The set of actions that can be evaluated against the role hierarchy.

## Side Effects

- Persists new grants and grant revocations via the `storage` module (write path only, never during evaluation).
- Emits `GrantCreated` event when a new grant is persisted.
- Emits `GrantRevoked` event when a grant is revoked. Downstream modules (notably `collab`) subscribe to this event to drop connections and reject intents for revoked principals.

## Invariants

- Permission evaluation is a pure function: given the same `Principal`, `PermissionQuery`, and `Grant[]`, the result is always identical. No I/O, no side effects, no network calls during evaluation.
- The role hierarchy is strictly ordered: owner > editor > commenter > viewer. A principal with a higher role implicitly holds all permissions of lower roles.
- Action-to-minimum-role mapping is fixed: `manage` and `share` require `owner`; `delete` and `write` require `editor`; `comment` requires `commenter`; `read` requires `viewer`.
- Expired grants (where `expiresAt` is in the past) are never treated as valid during evaluation. They are equivalent to absent grants.
- A resource with zero valid grants for a principal always evaluates to `{ allowed: false }`.
- Agent principals (`actorType: 'agent'`) are evaluated through the exact same code path as human principals. No special casing.
- Every `GrantRevoked` event is emitted after the revocation is persisted to storage, never before. If persistence fails, no event is emitted.
- The TOCTOU window between grant revocation and downstream enforcement (collab dropping connections) is approximately 200-500ms. This is a known limitation documented in Decision #003 and is not a bug.

## Dependencies

- `auth` -- Provides the `Principal` type. Permissions never resolves identity itself; it receives an already-resolved `Principal`.
- `storage` -- Persistence for `Grant` records. Permissions does not manage its own persistence layer.
- `events` -- Emits `GrantCreated` and `GrantRevoked` events for downstream subscribers.

## Boundary Rules

- MUST: Evaluate permissions as a pure function given a `Principal` and a set of `Grant` records. No I/O in the evaluation path.
- MUST: Enforce the role hierarchy (owner > editor > commenter > viewer) consistently across all evaluations.
- MUST: Emit a `GrantRevoked` event after every successful grant revocation.
- MUST: Emit a `GrantCreated` event after every successful grant creation.
- MUST: Treat agent principals identically to human principals in all evaluation logic.
- MUST: Reject expired grants during evaluation without requiring a separate cleanup step.
- MUST: Return a `reason` string in every `PermissionResult` explaining the decision.
- MUST NOT: Call into `collab` or any Document Domain module. Revocation enforcement in collab happens via event subscription, not direct calls.
- MUST NOT: Perform I/O during permission evaluation. Grant data must be loaded before the evaluate function is called.
- MUST NOT: Implement sharing UI, invite links, or link generation. That is the `sharing` module.
- MUST NOT: Resolve identity from tokens or API keys. That is the `auth` module.
- MUST NOT: Store or manage document content, metadata, or structure. That is the `document` module.
- MUST NOT: Introduce role types beyond the four defined roles without a deliberation and contract amendment.

## Verification

How to test each invariant:

- Pure evaluation -> Unit test: call the evaluate function with identical inputs 1000 times, assert all results are identical. Confirm the function signature accepts no I/O handles or async context.
- Role hierarchy ordering -> Property test: for every pair of roles (A, B) where A > B, grant a principal role A, assert all actions permitted by role B are also permitted by role A.
- Action-to-role mapping -> Unit test: for each action, verify the minimum required role. Assert `viewer` cannot `write`, `commenter` cannot `delete`, `editor` cannot `share`, etc. Exhaustive matrix of all action/role combinations.
- Expired grants rejected -> Unit test: create a grant with `expiresAt` in the past, evaluate a query against it, assert `allowed: false`. Create the same grant with `expiresAt` in the future, assert `allowed: true`.
- No grants means denied -> Unit test: evaluate a query with an empty grant set, assert `allowed: false` and `role: null`.
- Agent-human parity -> Unit test: evaluate identical queries for a human principal and an agent principal with the same grants, assert identical `PermissionResult` for both.
- GrantRevoked emitted after persistence -> Integration test (with `storage` and `events`): revoke a grant, assert the event is emitted only after the storage write succeeds. Simulate a storage failure, assert no event is emitted.
- No collab dependency -> Code-level audit: grep the module source for any import of `collab`, `document`, or `sharing`. Assert zero references.
- No I/O in evaluate -> Code-level audit: assert the evaluate function is synchronous, accepts no database handles, HTTP clients, or async parameters. Static analysis: confirm no `await`, `fetch`, or storage calls within the evaluate function body.

## MVP Scope

Implemented:
- [x] Pure function permission evaluation (given Principal, query, and grants)
- [x] Role hierarchy enforcement (owner > editor > commenter > viewer)
- [x] Action-to-minimum-role mapping
- [x] Expired grant rejection
- [x] Agent-human evaluation parity
- [x] No collab dependency (no direct imports)
- [x] Grant CRUD operations via storage
- [x] `reason` string in every `PermissionResult`

Post-MVP (deferred):
- [ ] `GrantCreated` event emission — requires events module implementation
- [ ] `GrantRevoked` event emission — requires events module implementation
