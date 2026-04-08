/** Contract: contracts/sharing/rules.md */

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createInMemoryShareLinkStore, type ShareLinkStore } from './store.ts';
import { createTestApp, fakePrincipal } from './routes-test-helpers.ts';
import { createShareRoutes } from './routes.ts';
import { createShareLinkService } from './share-links.ts';
import { createPermissions } from '../../permissions/index.ts';
import { createInMemoryPasswordRateLimiter } from './rate-limit.ts';

describe('share routes — DELETE /api/share/:token', () => {
  let store: ShareLinkStore;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    store = createInMemoryShareLinkStore();
    ({ app } = createTestApp(store));
  });

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
      rateLimiter: createInMemoryPasswordRateLimiter(),
    }));

    const res = await request(app2)
      .delete(`/api/share/${createRes.body.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });
});
