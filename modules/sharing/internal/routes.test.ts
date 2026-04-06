/** Contract: contracts/sharing/rules.md */

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createShareRoutes } from './routes.ts';
import { createShareLinkService } from './share-links.ts';
import { createInMemoryShareLinkStore, type ShareLinkStore } from './store.ts';

function createTestApp(store: ShareLinkStore) {
  const app = express();
  app.use(express.json());
  const service = createShareLinkService(store);
  app.use(createShareRoutes(service));
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
        .send({ role: 'view' });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.docId).toBe('doc-1');
      expect(res.body.role).toBe('view');
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

  describe('GET /api/share/:token', () => {
    it('resolves a valid token', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'edit' });

      const res = await request(app)
        .get(`/api/share/${createRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.grant.docId).toBe('doc-1');
      expect(res.body.grant.role).toBe('edit');
    });

    it('returns 404 for invalid token', async () => {
      const res = await request(app)
        .get('/api/share/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 410 for expired token', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'view', options: { expiresIn: 1 } });

      // Force expiration
      await store.update(createRes.body.token, {
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      const res = await request(app)
        .get(`/api/share/${createRes.body.token}`);

      expect(res.status).toBe(410);
      expect(res.body.error).toBe('expired');
    });

    it('returns 410 for revoked token', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'view' });

      await request(app)
        .delete(`/api/share/${createRes.body.token}`);

      const res = await request(app)
        .get(`/api/share/${createRes.body.token}`);

      expect(res.status).toBe(410);
      expect(res.body.error).toBe('revoked');
    });

    it('returns 403 for wrong password', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'view', options: { password: 'secret' } });

      const res = await request(app)
        .get(`/api/share/${createRes.body.token}?password=wrong`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('wrong_password');
    });

    it('resolves password-protected link with correct password', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'view', options: { password: 'secret' } });

      const res = await request(app)
        .get(`/api/share/${createRes.body.token}?password=secret`);

      expect(res.status).toBe(200);
      expect(res.body.grant.role).toBe('view');
    });
  });

  describe('DELETE /api/share/:token', () => {
    it('revokes an existing link', async () => {
      const createRes = await request(app)
        .post('/api/documents/doc-1/share')
        .send({ role: 'view' });

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
