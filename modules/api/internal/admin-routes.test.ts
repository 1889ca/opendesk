/** Contract: contracts/api/rules.md */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { purgeUserData } from './admin-routes.ts';
import { createPermissions } from '../../permissions/index.ts';
import { createInMemoryGrantStore } from '../../permissions/internal/grant-store.ts';
import { InMemoryCache } from './test-helpers.ts';

// Stub the storage module
vi.mock('../../storage/index.ts', () => {
  const docs = new Map<string, { id: string; title: string }>();
  return {
    listDocuments: vi.fn(async () => [...docs.values()]),
    createDocument: vi.fn(async (id: string, title: string) => {
      const doc = { id, title };
      docs.set(id, doc);
      return doc;
    }),
    getDocument: vi.fn(async (id: string) => docs.get(id) ?? null),
    deleteDocument: vi.fn(async (id: string) => {
      const existed = docs.has(id);
      docs.delete(id);
      return existed;
    }),
    updateDocumentTitle: vi.fn(async () => {}),
    _docs: docs,
  };
});

const storageMock = await import('../../storage/index.ts');
const docs = (storageMock as unknown as { _docs: Map<string, unknown> })._docs;

describe('purgeUserData', () => {
  let grantStore: ReturnType<typeof createInMemoryGrantStore>;
  let permissions: ReturnType<typeof createPermissions>;
  let cache: InMemoryCache;

  beforeEach(() => {
    docs.clear();
    grantStore = createInMemoryGrantStore();
    permissions = createPermissions({ grantStore });
    cache = new InMemoryCache();
  });

  it('deletes all documents owned by the user', async () => {
    // Create documents
    docs.set('doc-a', { id: 'doc-a', title: 'Doc A' });
    docs.set('doc-b', { id: 'doc-b', title: 'Doc B' });

    // Grant ownership
    await grantStore.create({
      principalId: 'user-1',
      resourceId: 'doc-a',
      resourceType: 'document',
      role: 'owner',
      grantedBy: 'user-1',
    });
    await grantStore.create({
      principalId: 'user-1',
      resourceId: 'doc-b',
      resourceType: 'document',
      role: 'owner',
      grantedBy: 'user-1',
    });

    // Set cache entries
    await cache.set('doc:doc-a', '{}', 'EX', 3600);

    const receipt = await purgeUserData(
      'user-1',
      'delete',
      undefined,
      permissions,
      cache,
    );

    expect(receipt.userId).toBe('user-1');
    expect(receipt.action).toBe('delete');
    expect(receipt.deletedAt).toBeTruthy();

    // Documents should be gone
    const docEntries = receipt.deleted.filter((d) => d.type === 'document');
    expect(docEntries).toHaveLength(2);

    // Grants should be gone
    const remaining = await grantStore.findByPrincipal('user-1');
    expect(remaining).toHaveLength(0);

    // Cache should be cleaned
    expect(await cache.get('doc:doc-a')).toBeNull();
  });

  it('transfers ownership when action is "transfer"', async () => {
    docs.set('doc-c', { id: 'doc-c', title: 'Doc C' });

    await grantStore.create({
      principalId: 'user-2',
      resourceId: 'doc-c',
      resourceType: 'document',
      role: 'owner',
      grantedBy: 'user-2',
    });

    // Also give user-2 a reader grant on another doc
    await grantStore.create({
      principalId: 'user-2',
      resourceId: 'doc-other',
      resourceType: 'document',
      role: 'viewer',
      grantedBy: 'admin',
    });

    const receipt = await purgeUserData(
      'user-2',
      'transfer',
      'user-3',
      permissions,
      cache,
    );

    expect(receipt.action).toBe('transfer');
    expect(receipt.transferTo).toBe('user-3');
    expect(receipt.transferred).toHaveLength(1);
    expect(receipt.transferred[0].id).toBe('doc-c');

    // The viewer grant should be revoked
    const deletedGrants = receipt.deleted.filter((d) => d.type === 'grant');
    expect(deletedGrants).toHaveLength(1);

    // New owner should have the grant
    const newGrants = await grantStore.findByPrincipalAndResource(
      'user-3',
      'doc-c',
      'document',
    );
    expect(newGrants).toHaveLength(1);
    expect(newGrants[0].role).toBe('owner');

    // Old user should have no grants
    const oldGrants = await grantStore.findByPrincipal('user-2');
    expect(oldGrants).toHaveLength(0);
  });

  it('handles user with no data gracefully', async () => {
    const receipt = await purgeUserData(
      'nonexistent-user',
      'delete',
      undefined,
      permissions,
      cache,
    );

    expect(receipt.deleted).toHaveLength(0);
    expect(receipt.transferred).toHaveLength(0);
  });
});
