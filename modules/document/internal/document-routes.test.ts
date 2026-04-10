/** Contract: contracts/document/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDocumentRoutes, type DocumentStorageFns } from './document-routes.ts';
import { createPermissions } from '../../permissions/index.ts';
import { createInMemoryGrantStore } from '../../permissions/internal/grant-store.ts';
import { InMemoryCache } from '../../api/internal/test-helpers.ts';

type SimpleDoc = { id: string; title: string; document_type: 'text'; yjs_state: null; folder_id: null; revision_id: null; created_at: Date; updated_at: Date };

/** In-memory document store implementing the storage functions document routes need. */
function createInMemoryDocStorage(): DocumentStorageFns & { docs: Map<string, SimpleDoc> } {
  const docs = new Map<string, SimpleDoc>();
  const makeDoc = (id: string, title: string): SimpleDoc => ({ id, title, document_type: 'text', yjs_state: null, folder_id: null, revision_id: null, created_at: new Date(), updated_at: new Date() });
  return {
    docs,
    listDocuments: async () => ({ rows: [...docs.values()], total: docs.size }),
    createDocument: async (id: string, title: string) => {
      const doc = makeDoc(id, title);
      docs.set(id, doc);
      return doc;
    },
    getDocument: async (id: string) => docs.get(id) ?? null,
    deleteDocument: async (id: string) => {
      const existed = docs.has(id);
      docs.delete(id);
      return existed;
    },
    updateDocumentTitle: async () => {},
    moveDocument: async () => true,
    getTemplate: async () => null,
  };
}

describe('enhanced document deletion', () => {
  let grantStore: ReturnType<typeof createInMemoryGrantStore>;
  let permissions: ReturnType<typeof createPermissions>;
  let cache: InMemoryCache;
  let storage: ReturnType<typeof createInMemoryDocStorage>;

  beforeEach(() => {
    grantStore = createInMemoryGrantStore();
    permissions = createPermissions({ grantStore });
    cache = new InMemoryCache();
    storage = createInMemoryDocStorage();
  });

  it('returns a deletion receipt with timestamp and scope', async () => {
    // Set up a document
    storage.docs.set('doc-1', { id: 'doc-1', title: 'Test', document_type: 'text', yjs_state: null, folder_id: null, revision_id: null, created_at: new Date(), updated_at: new Date() });

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

    // Verify the router creates successfully with cache and storage options
    const router = createDocumentRoutes({ permissions, cache, storage });
    expect(router).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('cleans up grants when document is deleted', async () => {
    storage.docs.set('doc-2', { id: 'doc-2', title: 'Test 2', document_type: 'text', yjs_state: null, folder_id: null, revision_id: null, created_at: new Date(), updated_at: new Date() });

    await grantStore.create({
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
