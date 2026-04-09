# Contract: sharing

## Purpose

Manage the lifecycle of access grants: creating, updating, and revoking grants that allow principals to collaborate on documents. Generate shareable links (token-based) that resolve to grants. Orchestrate invite-by-email workflows. This module writes to the permissions store but never evaluates permissions itself.

## Inputs

- `createGrant(principal: Principal, targetDocId: string, granteeEmail: string, role: GrantRole)`: Creates a new access grant for the specified grantee on the target document, subject to the principal's own permission level.
- `updateGrant(principal: Principal, grantId: string, newRole: GrantRole)`: Changes the role on an existing grant (e.g. `viewer` to `editor`), subject to the principal's own permission level.
- `revokeGrant(principal: Principal, grantId: string)`: Revokes an existing grant immediately and emits `GrantRevoked`.
- `createShareLink(principal: Principal, targetDocId: string, role: GrantRole, options?: ShareLinkOptions)`: Generates a shareable link token that, when accessed, resolves to a grant with the specified role.
- `redeemShareLink(token: string, redeemer: Principal)`: Resolves a share link token into a grant for the redeeming principal.
- `revokeShareLink(principal: Principal, token: string)`: Invalidates a share link token so it can no longer be redeemed.
- `inviteByEmail(principal: Principal, targetDocId: string, email: string, role: GrantRole)`: Sends a collaboration invite to the given email address. Creates a pending grant that activates when the invitee authenticates.

### Types

```
GrantRole: 'viewer' | 'editor' | 'commenter'

ShareLinkOptions: {
  expiresIn?: number       // TTL in seconds; if omitted, link does not auto-expire but remains revocable
  maxRedemptions?: number  // max times the link can be redeemed; if omitted, unlimited
}

Grant: {
  id:          string      // UUIDv4
  docId:       string
  grantorId:   string      // Principal.id of the user who created the grant
  granteeId:   string      // Principal.id of the user receiving access
  role:        GrantRole
  status:      'active' | 'pending' | 'revoked'
  createdAt:   ISOString
  revokedAt?:  ISOString
}

ShareLink: {
  token:           string      // opaque, cryptographically random token
  docId:           string
  grantorId:       string
  role:            GrantRole
  expiresAt?:      ISOString
  maxRedemptions?: number
  redemptionCount: number
  revoked:         boolean
  createdAt:       ISOString
}
```

## Outputs

- `Grant` -- written to the permissions store via the `permissions` module.
- `GrantCreated` event -- emitted via the `events` module when a grant is successfully created or a share link is redeemed.
- `GrantRevoked` event -- emitted via the `events` module immediately when a grant is revoked. The `collab` module subscribes to this event to disconnect revoked users.
- `ShareLink` -- persisted via the `storage` module. Resolved to a `Grant` upon redemption.

## Side Effects

- Writes grant records to the permissions store (via `permissions` module).
- Persists share link tokens and their metadata via the `storage` module.
- Emits `GrantCreated` and `GrantRevoked` domain events via the `events` module.
- Triggers invite email delivery (delegates to an outbound notification mechanism; does not send email directly).

## Invariants

- A principal can never grant a role higher than their own role on the target document. A `viewer` holder cannot grant `editor`. Enforced by querying the principal's own grant via the `permissions` module before writing.
- Every successful `revokeGrant` call emits a `GrantRevoked` event in the same transaction as the grant status change. There is no window where a grant is revoked but the event has not been emitted.
- Share link tokens are cryptographically random (minimum 256 bits of entropy) and opaque. They contain no embedded document IDs, roles, or user information.
- A share link with an `expiresAt` in the past cannot be redeemed. A revoked share link cannot be redeemed. A share link whose `redemptionCount >= maxRedemptions` cannot be redeemed.
- Redeeming a share link creates a full `Grant` record in the permissions store. Once redeemed, the grantee's access is independent of the link (revoking the link does not revoke already-created grants).
- A pending grant (from `inviteByEmail`) transitions to `active` only when the invitee authenticates and is matched by email. It never auto-activates.
- Grant status transitions are one-directional: `pending -> active -> revoked` or `active -> revoked`. A revoked grant is never reactivated; a new grant must be created instead.

## Dependencies

- `permissions` -- the sharing module writes grants to the permissions store. It also reads the grantor's current role to enforce the "cannot grant higher than own role" invariant. Sharing never evaluates whether a user can access a document; it only writes and reads grants.
- `auth` -- provides the `Principal` type used to identify who is sharing with whom.
- `events` -- the sharing module emits `GrantCreated` and `GrantRevoked` events. Events are emitted transactionally via the outbox pattern defined in the events contract.
- `storage` -- persistence for share link tokens and their metadata (expiration, redemption count, revocation state).

## Boundary Rules

- MUST: validate that the sharing principal holds a role >= the role being granted on the target document before creating or updating a grant.
- MUST: emit `GrantRevoked` event immediately (same transaction) when access is revoked.
- MUST: emit `GrantCreated` event when a grant is created, updated, or a share link is redeemed.
- MUST: generate share links with cryptographically random tokens (minimum 256 bits).
- MUST: enforce expiration, revocation, and max-redemption limits on share links at redemption time.
- MUST: create a full `Grant` record in the permissions store when a share link is redeemed.
- MUST: support pending grants for email invites that activate only upon invitee authentication.
- MUST: enforce one-directional grant status transitions (`pending -> active -> revoked`).
- MUST NOT: evaluate whether a user can access a document. That is the `permissions` module's responsibility.
- MUST NOT: import, call, or interact with the `collab` module directly. Communication with collab happens exclusively through `GrantRevoked` events.
- MUST NOT: send emails directly. Invite delivery is delegated to a notification mechanism outside this module's boundary.
- MUST NOT: embed document IDs, roles, or user information in share link tokens.
- MUST NOT: allow reactivation of a revoked grant. A new grant must be created instead.

## Verification

How to test each invariant:

- Cannot grant higher than own role --> Unit test: a principal with `viewer` role attempts to create a grant with `editor` role. Assert rejection. A principal with `editor` role grants `viewer`. Assert success.
- GrantRevoked emitted transactionally --> Integration test (with `events` and `storage`): revoke a grant, verify the `GrantRevoked` event exists in the PG outbox within the same transaction. Simulate a crash after revocation but before commit; verify neither the revocation nor the event persists.
- Share link token entropy --> Unit test: generate 1000 tokens, assert each is unique. Assert token length corresponds to >= 256 bits of randomness. Assert tokens contain no decodable document or user information.
- Expired/revoked/exhausted links rejected --> Unit test: attempt to redeem a link with `expiresAt` in the past, assert rejection. Revoke a link, attempt redemption, assert rejection. Set `maxRedemptions: 1`, redeem once, attempt a second redemption, assert rejection.
- Redeemed link creates independent grant --> Integration test: create a share link, redeem it, revoke the share link, verify the grant created by redemption is still `active` in the permissions store.
- Pending grant activation --> Integration test: call `inviteByEmail`, verify grant status is `pending`. Simulate invitee authentication with matching email, verify status transitions to `active`. Verify no activation occurs without authentication.
- One-directional status transitions --> Unit test: attempt to transition a `revoked` grant to `active`, assert rejection. Attempt to transition `active` to `pending`, assert rejection.
- No collab dependency --> Code-level audit: grep the module source for any import of `collab`. Assert zero references.
- No direct email sending --> Code-level audit: grep the module source for SMTP, sendmail, or email transport imports. Assert zero references.

## MVP Scope

Implemented:
- [x] Share link creation with cryptographically random tokens (256-bit entropy)
- [x] Share link redemption resolving to access
- [x] Share link revocation
- [x] Share link expiration and max-redemption enforcement
- [x] One-directional grant status transitions
- [x] No direct collab module dependency
- [x] No direct email sending
- [x] Full `Grant` record creation in permissions store on share link redemption
- [x] Share routes mounted in Express server with auth middleware

Post-MVP (deferred):
- [ ] "Cannot grant higher than own role" enforcement — requires auth wiring to look up grantor's role
- [ ] `GrantCreated` event emission — events module is now fully implemented; ready to wire via `createEventBus().emit()`
- [ ] `GrantRevoked` event emission — events module is now fully implemented; ready to wire via `createEventBus().emit()`
- [ ] Invite-by-email workflow (pending grants that activate on authentication)
- [ ] `updateGrant` role change support
