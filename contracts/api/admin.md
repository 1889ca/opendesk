# Admin Contract

## Purpose

GDPR-style user data purge endpoint that deletes or transfers all data owned by a user, returning a structured receipt.

## Inputs / Outputs

| Method | Path | Auth | Query Params | Output |
|--------|------|------|--------------|--------|
| DELETE | `/api/admin/users/:id/data` | required | `action` (`delete`\|`transfer`), `transferTo` (userId) | `PurgeReceipt` |

**PurgeReceipt schema:**
```typescript
{
  userId: string;
  action: 'delete' | 'transfer';
  transferTo?: string;        // only when action = 'transfer'
  deletedAt: string;          // ISO 8601 timestamp
  deleted: DeletionEntry[];   // { type: 'document'|'grant', id }
  transferred: DeletionEntry[];
}
```

## Invariants

- MUST: require authentication
- MUST: enforce self-only restriction — `req.principal.id` must equal `:id` param (403 otherwise)
- MUST: accept `action` as `"delete"` or `"transfer"` only (400 for anything else)
- MUST: require `transferTo` when `action` is `"transfer"` (400 if missing)
- MUST: in delete mode — delete all owned documents, clean up Redis cache (best-effort), remove all permission grants for deleted documents, then revoke all remaining grants
- MUST: in transfer mode — transfer document ownership to `transferTo` user (revoke old owner grant, create new owner grant), then revoke all non-owner grants
- MUST: return a complete `PurgeReceipt` listing every deleted and transferred resource
- MUST NOT: allow a user to purge another user's data

## Dependencies

- `storage` — `deleteDocument` for document deletion
- `permissions` — `grantStore.findByPrincipal`, `grantStore.deleteByResource`, `grantStore.revoke`, `grantStore.create` for grant management
- `redis` (optional) — `CacheClient` for best-effort cache cleanup (`doc:*`, `yjs:*` keys)

## Verification

- Unit test: request with mismatched principal returns 403
- Unit test: `action=transfer` without `transferTo` returns 400
- Unit test: invalid `action` value returns 400
- Integration test: delete mode removes all documents and grants, returns receipt
- Integration test: transfer mode reassigns ownership, revokes non-owner grants

## MVP Scope

Implemented:
- [x] DELETE endpoint with self-only restriction
- [x] Delete mode: removes documents, cache entries, and all grants
- [x] Transfer mode: reassigns ownership, revokes remaining grants
- [x] Structured purge receipt with deleted/transferred entries
- [x] Best-effort Redis cache cleanup (non-fatal on failure)
