/** Contract: contracts/sharing/rules.md */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createPermissions, type Role } from '../../permissions/index.ts';
import { createInMemoryShareLinkStore } from './store.ts';
import { createShareLinkService } from './share-links.ts';
import { createShareRoutes } from './routes.ts';
import { createInMemoryPasswordRateLimiter } from './rate-limit.ts';
import type { GrantStore } from '../../permissions/index.ts';

function fakeAs(id: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = { id, actorType: 'human', displayName: id, scopes: [] };
    next();
  };
}

async function buildApp(grantorId: string, grantorRole: Role): Promise<{
  app: ReturnType<typeof express>;
  grantStore: GrantStore;
}> {
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
  app.use(
    createShareRoutes({
      service,
      grantStore: permissions.grantStore,
      permissions,
      rateLimiter: createInMemoryPasswordRateLimiter(),
    }),
  );

  return { app, grantStore: permissions.grantStore };
}

describe('PATCH /api/grants/:grantId — updateGrant', () => {
  describe('valid downgrade: owner updates editor → viewer', () => {
    it('returns 200 with updated grant', async () => {
      const { app, grantStore } = await buildApp('alice', 'owner');

      // Create a grant for bob as editor
      const grant = await grantStore.create({
        principalId: 'bob',
        resourceId: 'doc-1',
        resourceType: 'document',
        role: 'editor',
        grantedBy: 'alice',
      });

      const res = await request(app)
        .patch(`/api/grants/${grant.id}`)
        .send({ role: 'viewer' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(grant.id);
      expect(res.body.role).toBe('viewer');
    });
  });

  describe('valid same-rank: owner updates editor → editor', () => {
    it('returns 200 with unchanged role', async () => {
      const { app, grantStore } = await buildApp('alice', 'owner');

      const grant = await grantStore.create({
        principalId: 'bob',
        resourceId: 'doc-1',
        resourceType: 'document',
        role: 'editor',
        grantedBy: 'alice',
      });

      const res = await request(app)
        .patch(`/api/grants/${grant.id}`)
        .send({ role: 'editor' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('editor');
    });
  });

  describe('rejection: viewer tries to grant owner role', () => {
    it('returns 403 with cannot_grant_higher_than_own_role', async () => {
      const { app, grantStore } = await buildApp('charlie', 'viewer');

      // Grant that charlie will try to update beyond their ceiling
      const grant = await grantStore.create({
        principalId: 'dave',
        resourceId: 'doc-1',
        resourceType: 'document',
        role: 'viewer',
        grantedBy: 'alice',
      });

      // charlie (viewer, rank 1) tries to raise dave to editor (rank 3)
      const res = await request(app)
        .patch(`/api/grants/${grant.id}`)
        .send({ role: 'editor' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('cannot_grant_higher_than_own_role');
    });
  });

  describe('rejection: grant not found', () => {
    it('returns 404', async () => {
      const { app } = await buildApp('alice', 'owner');

      const res = await request(app)
        .patch('/api/grants/00000000-0000-0000-0000-000000000000')
        .send({ role: 'viewer' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });

  describe('rejection: grant has been revoked (hard-deleted)', () => {
    it('returns 404 for a revoked (deleted) grant', async () => {
      const { app, grantStore } = await buildApp('alice', 'owner');

      const grant = await grantStore.create({
        principalId: 'bob',
        resourceId: 'doc-1',
        resourceType: 'document',
        role: 'editor',
        grantedBy: 'alice',
      });

      // Hard-delete the grant (revoke it)
      await grantStore.revoke(grant.id);

      const res = await request(app)
        .patch(`/api/grants/${grant.id}`)
        .send({ role: 'viewer' });

      // The permissions store hard-deletes on revoke, so revoked grants
      // are indistinguishable from never-existing grants → 404.
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });

  describe('rejection: invalid role', () => {
    it('returns 400 for unknown role', async () => {
      const { app, grantStore } = await buildApp('alice', 'owner');

      const grant = await grantStore.create({
        principalId: 'bob',
        resourceId: 'doc-1',
        resourceType: 'document',
        role: 'editor',
        grantedBy: 'alice',
      });

      const res = await request(app)
        .patch(`/api/grants/${grant.id}`)
        .send({ role: 'owner' }); // owner is not a shareable role

      expect(res.status).toBe(400);
    });
  });
});
