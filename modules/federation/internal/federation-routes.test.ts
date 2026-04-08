/** Contract: contracts/federation/rules.md */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createFederationRoutes } from './federation-routes.ts';
import type { FederationModule, FederationPeer, TransferRecord } from '../contract.ts';

const MOCK_PEER: FederationPeer = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  name: 'Partner Org',
  endpointUrl: 'https://partner.example.com',
  publicKey: 'pk-test',
  trustLevel: 'standard',
  status: 'active',
  lastSeenAt: null,
  registeredBy: 'user-1',
  createdAt: '2026-04-08T00:00:00Z',
};

const MOCK_TRANSFER: TransferRecord = {
  id: '550e8400-e29b-41d4-a716-446655440011',
  peerId: MOCK_PEER.id,
  direction: 'outbound',
  documentId: '550e8400-e29b-41d4-a716-446655440000',
  documentTitle: 'Shared Doc',
  signature: 'sig-test',
  auditProofHash: 'hash-test',
  status: 'completed',
  error: null,
  createdAt: '2026-04-08T00:00:00Z',
};

function makeMockFederation(overrides: Partial<FederationModule> = {}): FederationModule {
  return {
    registerPeer: vi.fn(async () => MOCK_PEER),
    listPeers: vi.fn(async () => [MOCK_PEER]),
    updatePeerStatus: vi.fn(async () => true),
    sendDocument: vi.fn(async () => MOCK_TRANSFER),
    receiveDocument: vi.fn(async () => ({ ...MOCK_TRANSFER, direction: 'inbound' as const })),
    listTransfers: vi.fn(async () => [MOCK_TRANSFER]),
    ...overrides,
  };
}

function makeMockPermissions() {
  return {
    requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (_req as { principal?: unknown }).principal = { id: 'user-1' };
      next();
    },
    checkPermission: vi.fn(async () => true),
    grantStore: { findByPrincipal: vi.fn(async () => []) },
  } as unknown as import('../../permissions/index.ts').PermissionsModule;
}

describe('federation routes', () => {
  it('POST /peers registers a peer', async () => {
    const fed = makeMockFederation();
    const app = express();
    app.use(express.json());
    app.use('/api/federation', createFederationRoutes({ federation: fed, permissions: makeMockPermissions() }));

    const res = await request(app)
      .post('/api/federation/peers')
      .send({ name: 'Partner', endpointUrl: 'https://partner.example.com', publicKey: 'pk-test' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Partner Org');
  });

  it('GET /peers lists peers', async () => {
    const fed = makeMockFederation();
    const app = express();
    app.use('/api/federation', createFederationRoutes({ federation: fed, permissions: makeMockPermissions() }));

    const res = await request(app).get('/api/federation/peers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /send sends a document', async () => {
    const fed = makeMockFederation();
    const app = express();
    app.use(express.json());
    app.use('/api/federation', createFederationRoutes({ federation: fed, permissions: makeMockPermissions() }));

    const res = await request(app)
      .post('/api/federation/send')
      .send({ documentId: '550e8400-e29b-41d4-a716-446655440000', peerId: MOCK_PEER.id });

    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('outbound');
    expect(res.body.status).toBe('completed');
  });

  it('POST /receive accepts a valid transfer', async () => {
    const fed = makeMockFederation();
    const app = express();
    app.use(express.json());
    app.use('/api/federation', createFederationRoutes({ federation: fed, permissions: makeMockPermissions() }));

    const res = await request(app)
      .post('/api/federation/receive')
      .send({
        sendingInstanceId: 'inst-1',
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        documentTitle: 'Test',
        yjsStateBase64: 'dGVzdA==',
        signature: 'sig',
        timestamp: new Date().toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('inbound');
  });

  it('GET /transfers lists transfer history', async () => {
    const fed = makeMockFederation();
    const app = express();
    app.use('/api/federation', createFederationRoutes({ federation: fed, permissions: makeMockPermissions() }));

    const res = await request(app).get('/api/federation/transfers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
