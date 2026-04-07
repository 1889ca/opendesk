/** Contract: contracts/sharing/rules.md */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createShareRoutes } from './routes.ts';
import { createShareLinkService } from './share-links.ts';
import { createInMemoryShareLinkStore, type ShareLinkStore } from './store.ts';
import { createInMemoryGrantStore, type GrantStore } from '../../permissions/index.ts';

/** Middleware that simulates auth by attaching a fake principal. */
function fakePrincipal(id = 'user-1') {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = { id, actorType: 'human', displayName: 'Test', scopes: [] };
    next();
  };
}

function createTestApp(store: ShareLinkStore, grantStore?: GrantStore) {
  const app = express();
  app.use(express.json());
  app.use(fakePrincipal());
  const service = createShareLinkService(store);
  app.use(createShareRoutes(service, { grantStore }));
  return app;
}

describe('share routes', () => {
  let store: ShareLinkStore;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    store = createInMemoryShareLinkStore();
    app = createTestApp(store);
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

    it('persists a Grant in the grant store on redemption', async () => {
      const grantStore = createInMemoryGrantStore();
      const appWithGrants = createTestApp(store, grantStore);

      const createRes = await request(appWithGrants)
        .post('/api/documents/doc-1/share')
        .send({ role: 'editor' });

      await request(appWithGrants)
        .post(`/api/share/${createRes.body.token}/resolve`)
        .send({});

      const grants = await grantStore.findByPrincipal('user-1');
      expect(grants).toHaveLength(1);
      expect(grants[0].resourceId).toBe('doc-1');
      expect(grants[0].role).toBe('editor');
    });
  });

  describe('DELETE /api/share/:token', () => {
    it('revokes an existing link', async () => {
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
  });
});
