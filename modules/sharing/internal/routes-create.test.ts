/** Contract: contracts/sharing/rules.md */

import { describe, it, expect, beforeEach } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { createInMemoryShareLinkStore, type ShareLinkStore } from './store.ts';
import { createTestApp } from './routes-test-helpers.ts';

describe('share routes — POST /api/documents/:id/share', () => {
  let store: ShareLinkStore;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    store = createInMemoryShareLinkStore();
    ({ app } = createTestApp(store));
  });

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
