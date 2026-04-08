/** Contract: contracts/erasure/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createErasureRoutes } from './erasure-routes.ts';
import type { ErasureModule, ErasureAttestation, RetentionPolicy, PrunePreview, PruneResult } from '../contract.ts';
import { createPermissions, type PermissionsModule } from '../../permissions/index.ts';

const DOC_ID = '550e8400-e29b-41d4-a716-446655440000';

const testAttestation: ErasureAttestation = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  docId: DOC_ID,
  type: 'redaction',
  actorId: 'user-1',
  legalBasis: 'GDPR request',
  details: 'Erased document',
  hash: 'a'.repeat(64),
  previousHash: null,
  issuedAt: '2026-04-08T00:00:00.000Z',
};

const testPolicy: RetentionPolicy = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Test Policy',
  target: 'kb_draft',
  maxAgeDays: 90,
  enabled: false,
  createdAt: '2026-04-08T00:00:00.000Z',
  updatedAt: '2026-04-08T00:00:00.000Z',
};

/** In-memory erasure module — vi.fn() spies for call tracking, real fixture data. */
function createInMemoryErasure(overrides: Partial<ErasureModule> = {}): ErasureModule {
  return {
    eraseDocument: vi.fn(async () => testAttestation),
    getAttestations: vi.fn(async () => [testAttestation]),
    createPolicy: vi.fn(async (data) => ({ ...testPolicy, ...data })),
    listPolicies: vi.fn(async () => [testPolicy]),
    deletePolicy: vi.fn(async () => true),
    scanRetention: vi.fn(async () => []),
    executeRetention: vi.fn(async () => [testAttestation]),
    previewPrune: vi.fn(async () => ({
      policyId: testPolicy.id,
      matchedEntries: [],
      wouldDelete: 0,
      dryRun: true as const,
    }) satisfies PrunePreview),
    executePrune: vi.fn(async () => ({
      policyId: testPolicy.id,
      deleted: 0,
      attestations: [],
      dryRun: false as const,
    }) satisfies PruneResult),
    ...overrides,
  };
}

/** Middleware that attaches a principal with admin scopes. */
function fakePrincipal(id = 'user-1') {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = { id, actorType: 'human', displayName: 'Admin', scopes: ['*'] };
    next();
  };
}

function createTestApp(erasure: ErasureModule, permissions: PermissionsModule) {
  const app = express();
  app.use(express.json());
  app.use(fakePrincipal());
  app.use('/api/erasure', createErasureRoutes({ erasure, permissions }));
  return app;
}

describe('erasure routes', () => {
  let permissions: PermissionsModule;

  beforeEach(async () => {
    permissions = createPermissions();
    // Grant manage-level access on the test document
    await permissions.grantStore.create({
      principalId: 'user-1', resourceId: DOC_ID, resourceType: 'document',
      role: 'owner', grantedBy: 'user-1',
    });
  });

  it('POST /erase creates an attestation', async () => {
    const erasure = createInMemoryErasure();
    const app = createTestApp(erasure, permissions);

    const res = await request(app)
      .post('/api/erasure/erase')
      .send({ documentId: DOC_ID, reason: 'GDPR request' });

    expect(res.status).toBe(201);
    expect(res.body.legalBasis).toBe('GDPR request');
  });

  it('GET /attestations/:documentId returns attestations', async () => {
    const erasure = createInMemoryErasure();
    const app = createTestApp(erasure, permissions);

    const res = await request(app).get(`/api/erasure/attestations/${DOC_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].docId).toBe(DOC_ID);
  });

  it('POST /policies creates a retention policy', async () => {
    const erasure = createInMemoryErasure();
    const app = createTestApp(erasure, permissions);

    const res = await request(app)
      .post('/api/erasure/policies')
      .send({ name: 'Test', target: 'kb_draft', maxAgeDays: 90 });

    expect(res.status).toBe(201);
    expect(res.body.maxAgeDays).toBe(90);
  });

  it('GET /policies lists policies', async () => {
    const erasure = createInMemoryErasure();
    const app = createTestApp(erasure, permissions);

    const res = await request(app).get('/api/erasure/policies');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /scan returns retention scan results', async () => {
    const erasure = createInMemoryErasure();
    const app = createTestApp(erasure, permissions);

    const res = await request(app).get('/api/erasure/scan');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });

  it('POST /execute runs auto-purge', async () => {
    const erasure = createInMemoryErasure();
    const app = createTestApp(erasure, permissions);

    const res = await request(app).post('/api/erasure/execute');
    expect(res.status).toBe(200);
    expect(res.body.executed).toBe(1);
  });
});
