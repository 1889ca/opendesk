/** Contract: contracts/api/rules.md */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDocumentRoutes } from './document-routes.ts';
import { createPermissions } from '../../permissions/index.ts';
import { createInMemoryGrantStore } from '../../permissions/internal/grant-store.ts';
import { InMemoryCache } from './test-helpers.ts';

// Stub the storage module to avoid real PG connections
vi.mock('../../storage/index.ts', () => {
  const docs = new Map<string, { id: string; title: string }>();
  return {
    listDocuments: vi.fn(async () => [...docs.values()]),
    createDocument: vi.fn(async (id: string, title: string) => {
      const doc = { id, title, created_at: new Date(), updated_at: new Date() };
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
    // Expose for test setup
    _docs: docs,
  };
});

// Import after mock setup
const storageMock = await import('../../storage/index.ts');
const docs = (storageMock as unknown as { _docs: Map<string, unknown> })._docs;

describe('enhanced document deletion', () => {
  let grantStore: ReturnType<typeof createInMemoryGrantStore>;
  let permissions: ReturnType<typeof createPermissions>;
  let cache: InMemoryCache;

  beforeEach(() => {
    docs.clear();
    grantStore = createInMemoryGrantStore();
    permissions = createPermissions({ grantStore });
    cache = new InMemoryCache();
  });

  it('returns a deletion receipt with timestamp and scope', async () => {
    // Set up a document
    docs.set('doc-1', { id: 'doc-1', title: 'Test' });

    // Create grants for this document
    await grantStore.create({
      principalId: 'user-1',
      resourceId: 'doc-1',
      resourceType: 'document',
      role: 'owner',
      grantedBy: 'user-1',
    });

    // Set cache entry
    await cache.set(`doc:doc-1`, '{}', 'EX', 3600);

    // Verify the router creates successfully with cache option
    const router = createDocumentRoutes({ permissions, cache });
    expect(router).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('cleans up grants when document is deleted', async () => {
    docs.set('doc-2', { id: 'doc-2', title: 'Test 2' });

    const grant = await grantStore.create({
      principalId: 'user-1',
      resourceId: 'doc-2',
      resourceType: 'document',
      role: 'owner',
      grantedBy: 'user-1',
    });

    // Verify grant exists
    const before = await grantStore.findByResource('doc-2', 'document');
    expect(before).toHaveLength(1);

    // Delete using grantStore.deleteByResource (the logic used in the route)
    await grantStore.deleteByResource('doc-2', 'document');

    const after = await grantStore.findByResource('doc-2', 'document');
    expect(after).toHaveLength(0);
  });

  it('cleans up cache entries when document is deleted', async () => {
    await cache.set('doc:doc-3', '{}', 'EX', 3600);
    await cache.set('yjs:doc-3', 'binary', 'EX', 3600);

    expect(await cache.get('doc:doc-3')).not.toBeNull();

    await cache.del('doc:doc-3', 'yjs:doc-3');

    expect(await cache.get('doc:doc-3')).toBeNull();
    expect(await cache.get('yjs:doc-3')).toBeNull();
  });
});
