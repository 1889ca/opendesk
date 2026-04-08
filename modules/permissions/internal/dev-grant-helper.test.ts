/** Contract: contracts/permissions/rules.md — Dev grant helper tests */
import { describe, it, expect, beforeEach } from 'vitest';
import { ensureDevGrant } from './dev-grant-helper.ts';
import { createInMemoryGrantStore, type GrantStore } from './grant-store.ts';

describe('ensureDevGrant()', () => {
  let store: GrantStore;

  beforeEach(() => {
    store = createInMemoryGrantStore();
  });

  it('creates an owner grant when none exists', async () => {
    await ensureDevGrant(store, 'dev-user', 'doc-1', 'document');

    const grants = await store.findByPrincipalAndResource('dev-user', 'doc-1', 'document');
    expect(grants).toHaveLength(1);
    expect(grants[0]!.role).toBe('owner');
    expect(grants[0]!.grantedBy).toBe('dev-auto');
  });

  it('does not create a duplicate when grant already exists', async () => {
    await store.create({
      principalId: 'dev-user',
      resourceId: 'doc-1',
      resourceType: 'document',
      role: 'editor',
      grantedBy: 'someone',
    });

    await ensureDevGrant(store, 'dev-user', 'doc-1', 'document');

    const grants = await store.findByPrincipalAndResource('dev-user', 'doc-1', 'document');
    expect(grants).toHaveLength(1);
    expect(grants[0]!.role).toBe('editor');
  });

  it('creates grants for different resources independently', async () => {
    await ensureDevGrant(store, 'dev-user', 'doc-1', 'document');
    await ensureDevGrant(store, 'dev-user', 'doc-2', 'document');

    const grants1 = await store.findByPrincipalAndResource('dev-user', 'doc-1', 'document');
    const grants2 = await store.findByPrincipalAndResource('dev-user', 'doc-2', 'document');
    expect(grants1).toHaveLength(1);
    expect(grants2).toHaveLength(1);
  });
});
