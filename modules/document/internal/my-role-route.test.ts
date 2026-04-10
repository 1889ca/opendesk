/** Contract: contracts/document/rules.md */

/**
 * Tests for GET /api/documents/:id/my-role — issue #154.
 *
 * Verifies that the endpoint returns the correct role for a principal
 * and that canWrite / canComment flags reflect the role hierarchy.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createDocumentRoutes, type DocumentStorageFns } from './document-routes.ts';
import { createPermissions } from '../../permissions/index.ts';
import { createInMemoryGrantStore } from '../../permissions/internal/grant-store.ts';
import type { Principal } from '../../auth/contract.ts';

type SimpleDoc = { id: string; title: string; document_type: 'text'; yjs_state: null; folder_id: null; revision_id: null; created_at: Date; updated_at: Date };

/** In-memory document storage for tests. */
function createTestDocStorage(docs: Record<string, { id: string; title: string }> = {}): DocumentStorageFns {
  const map = new Map<string, SimpleDoc>(
    Object.entries(docs).map(([k, v]) => [k, { ...v, document_type: 'text', yjs_state: null, folder_id: null, revision_id: null, created_at: new Date(), updated_at: new Date() }])
  );
  return {
    listDocuments: async () => ({ rows: [...map.values()], total: map.size }),
    createDocument: async (id, title) => {
      const doc: SimpleDoc = { id, title, document_type: 'text', yjs_state: null, folder_id: null, revision_id: null, created_at: new Date(), updated_at: new Date() };
      map.set(id, doc);
      return doc;
    },
    getDocument: async (id) => map.get(id) ?? null,
    deleteDocument: async (id) => { const had = map.has(id); map.delete(id); return had; },
    updateDocumentTitle: async () => {},
    moveDocument: async () => true,
    getTemplate: async () => null,
  };
}

/** Middleware that injects a fake principal for tests. */
function fakePrincipal(principal: Principal) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = principal;
    next();
  };
}

function makePrincipal(id: string): Principal {
  return { id, actorType: 'human', displayName: id, scopes: [] };
}

describe('GET /api/documents/:id/my-role — share link permission enforcement (#154)', () => {
  const DOC_ID = 'doc-abc';
  const alice = makePrincipal('alice');
  const bob = makePrincipal('bob');
  const carol = makePrincipal('carol');

  /** Build a test app wired with real in-memory stores. */
  async function buildApp(requestingUser: Principal) {
    const grantStore = createInMemoryGrantStore();
    const permissions = createPermissions({ grantStore });

    // Alice owns the document.
    await grantStore.create({
      principalId: alice.id,
      resourceId: DOC_ID,
      resourceType: 'document',
      role: 'owner',
      grantedBy: alice.id,
    });

    // Bob has viewer access.
    await grantStore.create({
      principalId: bob.id,
      resourceId: DOC_ID,
      resourceType: 'document',
      role: 'viewer',
      grantedBy: alice.id,
    });

    // Carol has commenter access.
    await grantStore.create({
      principalId: carol.id,
      resourceId: DOC_ID,
      resourceType: 'document',
      role: 'commenter',
      grantedBy: alice.id,
    });

    const app = express();
    app.use(express.json());
    app.use(fakePrincipal(requestingUser));
    app.use('/api/documents', createDocumentRoutes({ permissions, storage: createTestDocStorage({ [DOC_ID]: { id: DOC_ID, title: 'Test' } }) }));
    return app;
  }

  it('returns owner role with canWrite=true and canComment=true for document owner', async () => {
    const app = await buildApp(alice);
    const res = await request(app).get(`/api/documents/${DOC_ID}/my-role`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('owner');
    expect(res.body.canWrite).toBe(true);
    expect(res.body.canComment).toBe(true);
  });

  it('returns viewer role with canWrite=false and canComment=false for viewer share link', async () => {
    const app = await buildApp(bob);
    const res = await request(app).get(`/api/documents/${DOC_ID}/my-role`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('viewer');
    expect(res.body.canWrite).toBe(false);
    expect(res.body.canComment).toBe(false);
  });

  it('returns commenter role with canWrite=false and canComment=true for commenter share link', async () => {
    const app = await buildApp(carol);
    const res = await request(app).get(`/api/documents/${DOC_ID}/my-role`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('commenter');
    expect(res.body.canWrite).toBe(false);
    expect(res.body.canComment).toBe(true);
  });

  it('returns 403 for a user with no grant on the document', async () => {
    const dave = makePrincipal('dave');
    const app = await buildApp(dave);
    const res = await request(app).get(`/api/documents/${DOC_ID}/my-role`);

    // Permission middleware rejects before the route body runs.
    expect(res.status).toBe(403);
  });

  it('returns editor role with canWrite=true for editor grant', async () => {
    const grantStore = createInMemoryGrantStore();
    const permissions = createPermissions({ grantStore });
    const edgar = makePrincipal('edgar');

    await grantStore.create({
      principalId: edgar.id,
      resourceId: DOC_ID,
      resourceType: 'document',
      role: 'editor',
      grantedBy: alice.id,
    });

    const app = express();
    app.use(express.json());
    app.use(fakePrincipal(edgar));
    app.use('/api/documents', createDocumentRoutes({ permissions, storage: createTestDocStorage({ [DOC_ID]: { id: DOC_ID, title: 'Test' } }) }));

    const res = await request(app).get(`/api/documents/${DOC_ID}/my-role`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('editor');
    expect(res.body.canWrite).toBe(true);
    expect(res.body.canComment).toBe(true);
  });

  it('picks the highest role when the user has multiple grants', async () => {
    const grantStore = createInMemoryGrantStore();
    const permissions = createPermissions({ grantStore });
    const multi = makePrincipal('multi');

    // Viewer grant first, then editor — should resolve to editor.
    await grantStore.create({
      principalId: multi.id,
      resourceId: DOC_ID,
      resourceType: 'document',
      role: 'viewer',
      grantedBy: alice.id,
    });
    await grantStore.create({
      principalId: multi.id,
      resourceId: DOC_ID,
      resourceType: 'document',
      role: 'editor',
      grantedBy: alice.id,
    });

    const app = express();
    app.use(express.json());
    app.use(fakePrincipal(multi));
    app.use('/api/documents', createDocumentRoutes({ permissions, storage: createTestDocStorage({ [DOC_ID]: { id: DOC_ID, title: 'Test' } }) }));

    const res = await request(app).get(`/api/documents/${DOC_ID}/my-role`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('editor');
    expect(res.body.canWrite).toBe(true);
  });
});
