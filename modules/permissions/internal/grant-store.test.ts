/** Contract: contracts/permissions/rules.md — Grant store tests */
import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryGrantStore, type GrantStore } from './grant-store.ts';
import type { GrantDef } from '../contract.ts';

function makeDef(overrides: Partial<GrantDef> = {}): GrantDef {
  return {
    principalId: 'user-1',
    resourceId: 'doc-1',
    resourceType: 'document',
    role: 'editor',
    grantedBy: 'admin',
    ...overrides,
  };
}

describe('InMemoryGrantStore', () => {
  let store: GrantStore;

  beforeEach(() => {
    store = createInMemoryGrantStore();
  });

  it('creates a grant with generated id and timestamp', async () => {
    const grant = await store.create(makeDef());
    expect(grant.id).toBeTruthy();
    expect(grant.grantedAt).toBeTruthy();
    expect(grant.principalId).toBe('user-1');
    expect(grant.role).toBe('editor');
  });

  it('finds grants by principal and resource', async () => {
    await store.create(makeDef());
    await store.create(makeDef({ principalId: 'user-2' }));

    const results = await store.findByPrincipalAndResource('user-1', 'doc-1', 'document');
    expect(results).toHaveLength(1);
    expect(results[0].principalId).toBe('user-1');
  });

  it('finds grants by resource', async () => {
    await store.create(makeDef({ principalId: 'user-1' }));
    await store.create(makeDef({ principalId: 'user-2' }));
    await store.create(makeDef({ resourceId: 'doc-2' }));

    const results = await store.findByResource('doc-1', 'document');
    expect(results).toHaveLength(2);
  });

  it('revokes a grant by id', async () => {
    const grant = await store.create(makeDef());
    const revoked = await store.revoke(grant.id);
    expect(revoked).toBe(true);

    const found = await store.findById(grant.id);
    expect(found).toBeNull();
  });

  it('returns false when revoking nonexistent grant', async () => {
    const revoked = await store.revoke('nonexistent');
    expect(revoked).toBe(false);
  });

  it('finds a grant by id', async () => {
    const grant = await store.create(makeDef());
    const found = await store.findById(grant.id);
    expect(found).toEqual(grant);
  });

  it('returns null for nonexistent grant id', async () => {
    const found = await store.findById('nonexistent');
    expect(found).toBeNull();
  });

  it('stores expiresAt when provided', async () => {
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const grant = await store.create(makeDef({ expiresAt }));
    expect(grant.expiresAt).toBe(expiresAt);
  });
});
