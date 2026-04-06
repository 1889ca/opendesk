# Contract: auth

## Purpose

Resolve identity from OIDC/OAuth2 tokens and API keys into a `Principal`, providing the single source of truth for "who is making this request" across the entire system.

## Inputs

- `token`: `string` — A JWT/OIDC bearer token from an authenticated request
- `apiKey`: `string` — An API key identifying a service account (used by agents)
- `serviceAccountDef`: `{ displayName: string, scopes: string[] }` — Definition for creating/updating a service account

## Outputs

- `Principal`: `{ id: string, actorType: 'human' | 'agent' | 'system', displayName: string, email?: string, scopes: string[] }` — The resolved identity for the current request. Passed through the entire request lifecycle. Every downstream module that needs to know "who" consumes this type.
- `ServiceAccount`: `{ id: string, apiKey: string, displayName: string, scopes: string[], createdAt: string }` — Metadata for a registered service account.
- `AuthError`: `{ code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'TOKEN_MALFORMED' | 'KEY_INVALID' | 'KEY_REVOKED' | 'PROVIDER_UNREACHABLE', message: string }` — Typed error returned on authentication failure. No ambiguous failures.

## Side Effects

- Validates tokens against the OIDC provider (outbound network call on every token verification)
- Reads/writes service account credentials and metadata via the `storage` module

## Invariants

- Every successfully resolved `Principal` MUST include a non-empty `actorType` field set to exactly one of `'human'`, `'agent'`, or `'system'`.
- `actorType` is derived deterministically: OIDC tokens from human identity providers resolve to `'human'`; API keys and client credentials grants resolve to `'agent'`; internal system calls resolve to `'system'`.
- A given token or API key always resolves to the same `Principal.id` (identity is stable).
- Expired or invalid credentials never produce a `Principal` — they always produce an `AuthError`.
- The `scopes` array on a `Principal` reflects the scopes granted at authentication time and is never modified by this module after resolution.
- Service account API keys are stored hashed; raw keys are returned exactly once at creation time.

## Dependencies

- `storage` — Persistence for service account records (credentials, metadata, revocation state). Auth does not manage its own persistence layer.

## Boundary Rules

- MUST: Resolve any valid OIDC token to a `Principal` with `actorType: 'human'`.
- MUST: Resolve any valid API key or client credentials grant to a `Principal` with `actorType: 'agent'`.
- MUST: Resolve internal system-initiated requests to a `Principal` with `actorType: 'system'`.
- MUST: Include `actorType` on every `Principal`, unconditionally.
- MUST: Reject expired, malformed, or revoked credentials with a typed `AuthError` (never a generic error).
- MUST: Provide CRUD operations for service accounts (create, read, revoke).
- MUST: Hash API keys before storage; return the raw key only on creation.
- MUST NOT: Evaluate permissions, enforce access control, or check authorization rules. That is the `permissions` module.
- MUST NOT: Manage user profiles, preferences, or any user data beyond identity.
- MUST NOT: Implement session state, session cookies, or server-side session storage. Verification is stateless.
- MUST NOT: Cache tokens or principals in-process across requests. Each request re-verifies.
- MUST NOT: Expose raw OIDC provider secrets or signing keys outside the module boundary.

## Verification

How to test each invariant:

- Every Principal has actorType -> Property test: generate random valid tokens of each type, assert `actorType` is always present and is one of the three allowed values.
- Deterministic actorType derivation -> Unit test: verify OIDC tokens produce `'human'`, API keys produce `'agent'`, system calls produce `'system'`. No crossover.
- Stable identity -> Unit test: resolve the same token twice, assert `Principal.id` is identical both times.
- Invalid credentials never produce Principal -> Unit test: supply expired tokens, revoked keys, malformed JWTs, garbage strings. Assert every case returns `AuthError`, never `Principal`.
- Scopes are immutable after resolution -> Unit test: resolve a token, capture scopes, assert the module provides no method to mutate them post-resolution.
- API keys stored hashed -> Integration test (with `storage`): create a service account, read the stored record, assert the stored key does not match the raw key returned at creation. Assert the raw key is not retrievable after creation.
- No permission evaluation -> Code-level audit: grep the module source for any import of `permissions`. Assert zero references. Contract test: confirm no method signature accepts a "resource" or "action" for access-control purposes.
- Stateless verification -> Code-level audit: assert no in-memory cache, session store, or request-scoped mutable state persists between calls.
