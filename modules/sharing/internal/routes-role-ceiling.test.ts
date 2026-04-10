/** Contract: contracts/sharing/rules.md */

/**
 * Tests for the "cannot grant higher than own role" invariant (#84).
 *
 * There are two enforcement layers on the share creation endpoint:
 * 1. permissions.require('write') — blocks viewer/commenter from reaching
 *    the endpoint at all (they cannot write to the document).
 * 2. Role-ceiling check — blocks any principal from issuing a share link
 *    with a higher role than their own, even if they have write access.
 *
 * Tests in the first section verify write-gate behaviour.
 * Tests in the second section bypass the write gate and test the ceiling
 * check in isolation, covering the case where the ceiling would block
 * a principal who somehow has write access but a lower-ranked role.
 */

import { describe, it, expect } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createInMemoryShareLinkStore } from './store.ts';
import { createShareLinkService } from './share-links.ts';
import { createShareRoutes } from './routes.ts';
import { createPermissions, type PermissionsModule, type Role } from '../../permissions/index.ts';
import { createInMemoryPasswordRateLimiter } from './rate-limit.ts';

function fakeAs(id: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = { id, actorType: 'human', displayName: id, scopes: [] };
    next();
  };
}

async function buildApp(grantorId: string, grantorRole: Role) {
  const permissions = createPermissions();
  await permissions.grantStore.create({
    principalId: grantorId,
    resourceId: 'doc-1',
    resourceType: 'document',
    role: grantorRole,
    grantedBy: grantorId,
  });
  const service = createShareLinkService(createInMemoryShareLinkStore());
  const app = express();
  app.use(express.json());
  app.use(fakeAs(grantorId));
  app.use(createShareRoutes({
    service,
    grantStore: permissions.grantStore,
    permissions,
    rateLimiter: createInMemoryPasswordRateLimiter(),
  }));
  return app;
}

/**
 * Build an app where permissions.require() is a no-op so we can test
 * the ceiling check in isolation, independent of the write gate.
 */
async function buildAppNpGate(grantorId: string, grantorRole: Role) {
  const permissions = createPermissions();
  await permissions.grantStore.create({
    principalId: grantorId,
    resourceId: 'doc-1',
    resourceType: 'document',
    role: grantorRole,
    grantedBy: grantorId,
  });

  const noGatePerms: PermissionsModule = {
    ...permissions,
    require: () => async (_req, _res, next) => { next(); },
    requireAuth: async (_req, _res, next) => { next(); },
  };

  const service = createShareLinkService(createInMemoryShareLinkStore());
  const app = express();
  app.use(express.json());
  app.use(fakeAs(grantorId));
  app.use(createShareRoutes({
    service,
    grantStore: permissions.grantStore,
    permissions: noGatePerms,
    rateLimiter: createInMemoryPasswordRateLimiter(),
  }));
  return app;
}

describe('role ceiling — write-gate layer', () => {
  it('owner can create an editor link', async () => {
    const app = await buildApp('alice', 'owner');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'editor' });
    expect(res.status).toBe(201);
  });

  it('owner can create a viewer link', async () => {
    const app = await buildApp('alice', 'owner');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'viewer' });
    expect(res.status).toBe(201);
  });

  it('editor can create a viewer link', async () => {
    const app = await buildApp('bob', 'editor');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'viewer' });
    expect(res.status).toBe(201);
  });

  it('editor can create a commenter link', async () => {
    const app = await buildApp('bob', 'editor');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'commenter' });
    expect(res.status).toBe(201);
  });

  it('editor can create an editor link (same rank)', async () => {
    const app = await buildApp('bob', 'editor');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'editor' });
    expect(res.status).toBe(201);
  });

  it('viewer is blocked at the write gate — 403', async () => {
    const app = await buildApp('charlie', 'viewer');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'viewer' });
    expect(res.status).toBe(403);
  });

  it('commenter is blocked at the write gate — 403', async () => {
    const app = await buildApp('diana', 'commenter');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'commenter' });
    expect(res.status).toBe(403);
  });
});

describe('role ceiling — ceiling check in isolation (write gate bypassed)', () => {
  it('viewer cannot create an editor link — ceiling blocks it', async () => {
    const app = await buildAppNpGate('charlie', 'viewer');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'editor' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('cannot_grant_higher_than_own_role');
  });

  it('viewer cannot create a commenter link — ceiling blocks it', async () => {
    const app = await buildAppNpGate('charlie', 'viewer');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'commenter' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('cannot_grant_higher_than_own_role');
  });

  it('viewer can create a viewer link (same rank)', async () => {
    const app = await buildAppNpGate('charlie', 'viewer');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'viewer' });
    expect(res.status).toBe(201);
  });

  it('commenter cannot create an editor link — ceiling blocks it', async () => {
    const app = await buildAppNpGate('diana', 'commenter');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'editor' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('cannot_grant_higher_than_own_role');
  });

  it('commenter can create a commenter link (same rank)', async () => {
    const app = await buildAppNpGate('diana', 'commenter');
    const res = await request(app).post('/api/documents/doc-1/share').send({ role: 'commenter' });
    expect(res.status).toBe(201);
  });
});
