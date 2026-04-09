/** Contract: contracts/federation/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createFederationRoutes } from './federation-routes.ts';
import type { FederationModule, FederationPeer, TransferRecord } from '../contract.ts';
import { signPayload } from './signing.ts';
import { createPermissions, type PermissionsModule } from '../../permissions/index.ts';

const { publicKey: testPublicKey, privateKey: testPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const testPeer: FederationPeer = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  name: 'Partner Org',
  endpointUrl: 'https://partner.example.com',
  publicKey: testPublicKey,
  trustLevel: 'standard',
  status: 'active',
  lastSeenAt: null,
  registeredBy: 'user-1',
  createdAt: '2026-04-08T00:00:00Z',
};

const testTransfer: TransferRecord = {
  id: '550e8400-e29b-41d4-a716-446655440011',
  peerId: testPeer.id,
  direction: 'outbound',
  documentId: '550e8400-e29b-41d4-a716-446655440000',
  documentTitle: 'Shared Doc',
  signature: 'sig-test',
  auditProofHash: 'hash-test',
  status: 'completed',
  error: null,
  createdAt: '2026-04-08T00:00:00Z',
};

/** In-memory federation module — vi.fn() spies for call tracking, real data. */
function createInMemoryFederation(overrides: Partial<FederationModule> = {}): FederationModule {
  return {
    registerPeer: vi.fn(async () => testPeer),
    listPeers: vi.fn(async () => [testPeer]),
    updatePeerStatus: vi.fn(async () => true),
    sendDocument: vi.fn(async () => testTransfer),
    receiveDocument: vi.fn(async () => ({ ...testTransfer, direction: 'inbound' as const })),
    listTransfers: vi.fn(async () => [testTransfer]),
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

function createTestApp(fed: FederationModule, permissions: PermissionsModule) {
  const app = express();
  app.use(express.json());
  app.use(fakePrincipal());
  app.use('/api/federation', createFederationRoutes({ federation: fed, permissions }));
  return app;
}

describe('federation routes', () => {
  let permissions: PermissionsModule;

  beforeEach(async () => {
    permissions = createPermissions();
    await permissions.grantStore.create({
      principalId: 'user-1',
      resourceId: '550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'document',
      role: 'owner',
      grantedBy: 'user-1',
    });
  });

  it('POST /peers registers a peer', async () => {
    const fed = createInMemoryFederation();
    const app = createTestApp(fed, permissions);

    const res = await request(app)
      .post('/api/federation/peers')
      .send({ name: 'Partner', endpointUrl: 'https://partner.example.com', publicKey: 'pk-test' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Partner Org');
  });

  it('GET /peers lists peers', async () => {
    const fed = createInMemoryFederation();
    const app = createTestApp(fed, permissions);

    const res = await request(app).get('/api/federation/peers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /send sends a document', async () => {
    const fed = createInMemoryFederation();
    const app = createTestApp(fed, permissions);

    const res = await request(app)
      .post('/api/federation/send')
      .send({ documentId: '550e8400-e29b-41d4-a716-446655440000', peerId: testPeer.id });

    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('outbound');
    expect(res.body.status).toBe('completed');
  });

  it('POST /receive accepts a valid transfer', async () => {
    const fed = createInMemoryFederation();
    const app = createTestApp(fed, permissions);

    const timestamp = new Date().toISOString();
    const bundle = {
      sendingInstanceId: 'Partner Org',
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      documentTitle: 'Test',
      yjsStateBase64: 'dGVzdA==',
      timestamp,
    };
    const signature = signPayload(JSON.stringify({
      sendingInstanceId: bundle.sendingInstanceId,
      documentId: bundle.documentId,
      yjsStateBase64: bundle.yjsStateBase64,
      timestamp: bundle.timestamp,
    }), testPrivateKey);

    const res = await request(app)
      .post('/api/federation/receive')
      .send({ ...bundle, signature });

    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('inbound');
  });

  it('GET /transfers lists transfer history', async () => {
    const fed = createInMemoryFederation();
    const app = createTestApp(fed, permissions);

    const res = await request(app).get('/api/federation/transfers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
