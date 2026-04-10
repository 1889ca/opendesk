/** Contract: contracts/sharing/rules.md */

import { describe, it, expect, beforeEach } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { createInMemoryShareLinkStore, type ShareLinkStore } from './store.ts';
import { createTestApp } from './routes-test-helpers.ts';

describe('share routes — POST /api/share/:token/resolve', () => {
  let store: ShareLinkStore;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    store = createInMemoryShareLinkStore();
    ({ app } = createTestApp(store));
  });

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
  }, 15_000);

  it('resolves password-protected link with correct password', async () => {
    const createRes = await request(app)
      .post('/api/documents/doc-1/share')
      .send({ role: 'viewer', options: { password: 'secret' } });

    const res = await request(app)
      .post(`/api/share/${createRes.body.token}/resolve`)
      .send({ password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body.grant.role).toBe('viewer');
  }, 15_000);

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
  }, 15_000);
});
