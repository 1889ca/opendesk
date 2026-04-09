/** Contract: contracts/api/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createReferenceRoutes } from './reference-routes.ts';
import { createPermissions, createInMemoryGrantStore } from '../../permissions/index.ts';
import type { Principal } from '../../auth/contract.ts';
import type { ReferenceRow } from '../../references/index.ts';

const DEFAULT_WORKSPACE = '00000000-0000-0000-0000-000000000000';

/** Build a Principal-injecting middleware (no mocks — Principal is the real type). */
function authAs(principal: Principal) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = principal;
    next();
  };
}

function makePrincipal(id: string): Principal {
  return {
    id,
    actorType: 'human',
    displayName: id,
    email: `${id}@opendesk.local`,
    scopes: [],
  };
}

/**
 * Build an Express app mounting the reference routes with a real
 * in-memory permissions module and a stub `getReference` so we can
 * exercise the auth/permission gates without a Postgres connection.
 */
function buildApp(opts: {
  principal: Principal;
  storedReference: ReferenceRow | null;
}) {
  const grantStore = createInMemoryGrantStore();
  const permissions = createPermissions({ grantStore, authMode: 'oidc' });

  const app = express();
  app.use(express.json());
  app.use(authAs(opts.principal));
  app.use('/api/references', createReferenceRoutes({
    permissions,
    store: {
      getReference: async () => opts.storedReference,
    },
  }));

  return { app, grantStore, permissions };
}

describe('GET /api/references/:id — issue #129 IDOR fix', () => {
  let bob: Principal;
  let alice: Principal;
  let storedRef: ReferenceRow;

  beforeEach(() => {
    bob = makePrincipal('user-bob');
    alice = makePrincipal('user-alice');
    storedRef = {
      id: 'ref-1',
      workspace_id: DEFAULT_WORKSPACE,
      title: 'Some paper',
      authors: ['Author A'],
      year: 2024,
      source: null,
      volume: null,
      issue: null,
      pages: null,
      doi: null,
      isbn: null,
      url: null,
      publisher: null,
      type: 'article',
      created_by: 'user-alice',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as ReferenceRow;
  });

  it('rejects an authenticated user with no library grant (403)', async () => {
    const { app } = buildApp({ principal: bob, storedReference: storedRef });

    const res = await request(app).get('/api/references/ref-1');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'No read access to reference library' });
  });

  it('returns the reference when the user has a library read grant', async () => {
    const { app, grantStore } = buildApp({ principal: alice, storedReference: storedRef });

    // Seed a real grant — same shape the real workflow creates.
    await grantStore.create({
      principalId: alice.id,
      resourceId: DEFAULT_WORKSPACE,
      resourceType: 'reference-library',
      role: 'viewer',
      grantedBy: 'test-suite',
    });

    const res = await request(app).get('/api/references/ref-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('ref-1');
  });

  it('returns 404 when the reference does not exist but the user has access', async () => {
    const { app, grantStore } = buildApp({ principal: alice, storedReference: null });

    await grantStore.create({
      principalId: alice.id,
      resourceId: DEFAULT_WORKSPACE,
      resourceType: 'reference-library',
      role: 'viewer',
      grantedBy: 'test-suite',
    });

    const res = await request(app).get('/api/references/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Reference not found' });
  });
});
