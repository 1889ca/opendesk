/** Contract: contracts/erasure/rules.md */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createErasureRoutes } from './erasure-routes.ts';
import type { ErasureModule, ErasureAttestation, RetentionPolicy } from '../contract.ts';

const MOCK_ATTESTATION: ErasureAttestation = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  documentId: '550e8400-e29b-41d4-a716-446655440000',
  actorId: 'user-1',
  actorType: 'human',
  reason: 'GDPR request',
  preStateHash: 'abc123',
  postStateHash: 'def456',
  stateChanged: true,
  yjsSizeBefore: 10240,
  yjsSizeAfter: 2048,
  createdAt: '2026-04-08T00:00:00.000Z',
};

const MOCK_POLICY: RetentionPolicy = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Test Policy',
  documentType: '*',
  maxAgeDays: 90,
  autoPurge: false,
  createdBy: 'user-1',
  createdAt: '2026-04-08T00:00:00.000Z',
};

function makeMockErasure(overrides: Partial<ErasureModule> = {}): ErasureModule {
  return {
    eraseDocument: vi.fn(async () => MOCK_ATTESTATION),
    getAttestations: vi.fn(async () => [MOCK_ATTESTATION]),
    createPolicy: vi.fn(async (data) => ({ ...MOCK_POLICY, ...data })),
    listPolicies: vi.fn(async () => [MOCK_POLICY]),
    deletePolicy: vi.fn(async () => true),
    scanRetention: vi.fn(async () => []),
    executeRetention: vi.fn(async () => [MOCK_ATTESTATION]),
    ...overrides,
  };
}

function makeMockPermissions() {
  return {
    requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (_req as { principal?: unknown }).principal = { id: 'user-1' };
      next();
    },
    require: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    requireForResource: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    checkPermission: vi.fn(async () => true),
    grantStore: { findByPrincipal: vi.fn(async () => []) },
  } as unknown as import('../../permissions/index.ts').PermissionsModule;
}

describe('erasure routes', () => {
  it('POST /erase creates an attestation', async () => {
    const erasure = makeMockErasure();
    const app = express();
    app.use(express.json());
    app.use('/api/erasure', createErasureRoutes({ erasure, permissions: makeMockPermissions() }));

    const res = await request(app)
      .post('/api/erasure/erase')
      .send({ documentId: '550e8400-e29b-41d4-a716-446655440000', reason: 'GDPR request' });

    expect(res.status).toBe(201);
    expect(res.body.stateChanged).toBe(true);
    expect(res.body.reason).toBe('GDPR request');
  });

  it('GET /attestations/:documentId returns attestations', async () => {
    const erasure = makeMockErasure();
    const app = express();
    app.use('/api/erasure', createErasureRoutes({ erasure, permissions: makeMockPermissions() }));

    const res = await request(app)
      .get('/api/erasure/attestations/550e8400-e29b-41d4-a716-446655440000');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].documentId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('POST /policies creates a retention policy', async () => {
    const erasure = makeMockErasure();
    const app = express();
    app.use(express.json());
    app.use('/api/erasure', createErasureRoutes({ erasure, permissions: makeMockPermissions() }));

    const res = await request(app)
      .post('/api/erasure/policies')
      .send({ name: 'Test', maxAgeDays: 90 });

    expect(res.status).toBe(201);
    expect(res.body.maxAgeDays).toBe(90);
  });

  it('GET /policies lists policies', async () => {
    const erasure = makeMockErasure();
    const app = express();
    app.use('/api/erasure', createErasureRoutes({ erasure, permissions: makeMockPermissions() }));

    const res = await request(app).get('/api/erasure/policies');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /scan returns retention scan results', async () => {
    const erasure = makeMockErasure();
    const app = express();
    app.use('/api/erasure', createErasureRoutes({ erasure, permissions: makeMockPermissions() }));

    const res = await request(app).get('/api/erasure/scan');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });

  it('POST /execute runs auto-purge', async () => {
    const erasure = makeMockErasure();
    const app = express();
    app.use(express.json());
    app.use('/api/erasure', createErasureRoutes({ erasure, permissions: makeMockPermissions() }));

    const res = await request(app).post('/api/erasure/execute');

    expect(res.status).toBe(200);
    expect(res.body.executed).toBe(1);
  });
});
