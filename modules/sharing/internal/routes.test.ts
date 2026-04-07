/** Contract: contracts/sharing/rules.md */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createShareRoutes } from './routes.ts';
import { createShareLinkService } from './share-links.ts';
import { createInMemoryShareLinkStore, type ShareLinkStore } from './store.ts';
import { createPermissions } from '../../permissions/index.ts';

/** Middleware that simulates auth by attaching a fake principal. */
function fakePrincipal(id = 'user-1') {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = { id, actorType: 'human', displayName: 'Test', scopes: [] };
    next();
  };
}

function createTestApp(store: ShareLinkStore, principalId = 'user-1') {
  const app = express();
  app.use(express.json());
  const permissions = createPermissions();

  // Grant owner role on doc-1 to the default test user
  permissions.grantStore.create({
    principalId,
    resourceId: 'doc-1',
    resourceType: 'document',
    role: 'owner',
    grantedBy: principalId,
  });

  app.use(fakePrincipal(principalId));
  const service = createShareLinkService(store);
  app.use(createShareRoutes({
    service,
    grantStore: permissions.grantStore,
    permissions,
  }));
  return { app, permissions };
}

describe('share routes', () => {
  let store: ShareLinkStore;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    store = createInMemoryShareLinkStore();
    ({ app } = createTestApp(store));
  });

  describe('POST /api/documents/:id/share', () => {
    it('creates a share link (201)', async () => {
      const res = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'viewer' });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.docId).toBe('doc-1');
      expect(res.body.role).toBe('viewer');
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('rejects invalid role (400)', async () => {
      const res = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'admin' });

      expect(res.status).toBe(400);
    });

    it('rejects missing role (400)', async () => {
      const res = await request(app)
        .post('/api/documents/doc-1/share')
        .send({});

      expect(res.status).toBe(400);
    });

    it('rejects user without write permission (403)', async () => {
      const res = await request(app)
        .post('/api/documents/no-access-doc/share')
        .send({ role: 'viewer' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/share/:token/resolve', () => {
    it('resolves a valid token', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'editor' });

      const res = await request(app)
        .post(`/api/share/${createRes.body.token}/resolve`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.grant.docId).toBe('doc-1');
      expect(res.body.grant.role).toBe('editor');
    });

    it('returns 404 for invalid token', async () => {
      const res = await request(app)
        .post('/api/share/nonexistent/resolve')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 410 for expired token', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'viewer', options: { expiresIn: 1 } });

      // Force expiration
      await store.update(createRes.body.token, {
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      const res = await request(app)
        .post(`/api/share/${createRes.body.token}/resolve`)
        .send({});

      expect(res.status).toBe(410);
      expect(res.body.error).toBe('expired');
    });

    it('returns 410 for revoked token', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'viewer' });

      await request(app)
        .delete(`/api/share/${createRes.body.token}`);

      const res = await request(app)
        .post(`/api/share/${createRes.body.token}/resolve`)
        .send({});

      expect(res.status).toBe(410);
      expect(res.body.error).toBe('revoked');
    });

    it('returns 403 for wrong password', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'viewer', options: { password: 'secret' } });

      const res = await request(app)
        .post(`/api/share/${createRes.body.token}/resolve`)
        .send({ password: 'wrong' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('wrong_password');
    });

    it('resolves password-protected link with correct password', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'viewer', options: { password: 'secret' } });

      const res = await request(app)
        .post(`/api/share/${createRes.body.token}/resolve`)
        .send({ password: 'secret' });

      expect(res.status).toBe(200);
      expect(res.body.grant.role).toBe('viewer');
    });

    it('rate-limits after too many wrong password attempts (429)', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'viewer', options: { password: 'secret' } });

      const token = createRes.body.token;

      // Exhaust the rate limit (5 wrong attempts)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/share/${token}/resolve`)
          .send({ password: 'wrong' });
      }

      // 6th attempt should be rate-limited
      const res = await request(app)
        .post(`/api/share/${token}/resolve`)
        .send({ password: 'wrong' });
      expect(res.status).toBe(429);
      expect(res.body.error).toBe('too_many_attempts');
    });
  });

  describe('DELETE /api/share/:token', () => {
    it('revokes an existing link (as creator)', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'viewer' });

      const res = await request(app)
        .delete(`/api/share/${createRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('returns 404 for non-existent token', async () => {
      const res = await request(app)
        .delete('/api/share/nonexistent');

      expect(res.status).toBe(404);
    });

    it('rejects revocation by non-owner without write permission (403)', async () => {
      // Create a link as user-1
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'viewer' });

      // Build a second app with a different user who has no permissions
      const app2 = express();
      app2.use(express.json());
      const permissions2 = createPermissions();
      app2.use(fakePrincipal('user-2'));
      const service2 = createShareLinkService(store);
      app2.use(createShareRoutes({
        service: service2,
        permissions: permissions2,
      }));

      const res = await request(app2)
        .delete(`/api/share/${createRes.body.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });
  });
});
