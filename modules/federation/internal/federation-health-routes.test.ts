/** Contract: contracts/federation/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createFederationHealthRoutes } from './federation-health-routes.ts';
import type { FederationModule, FederationPeer, PeerHealthEntry, PingResult } from '../contract.ts';
import { createPermissions, type PermissionsModule } from '../../permissions/index.ts';

const testPeer: FederationPeer = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  name: 'Partner Org',
  endpointUrl: 'https://partner.example.com',
  publicKey: 'pk-test',
  trustLevel: 'standard',
  status: 'active',
  lastSeenAt: '2026-05-01T10:00:00Z',
  registeredBy: 'user-1',
  createdAt: '2026-04-01T00:00:00Z',
};

const testHealthEntry: PeerHealthEntry = {
  peer: testPeer,
  lastSuccessfulSyncAt: '2026-05-01T09:00:00Z',
  conflictCount: 2,
  failedRequestCount: 1,
  connectionStatus: 'connected',
};

const testPingResult: PingResult = {
  peerId: testPeer.id,
  reachable: true,
  latencyMs: 42,
  error: null,
};

function createInMemoryFederation(overrides: Partial<FederationModule> = {}): FederationModule {
  return {
    registerPeer: vi.fn(async () => testPeer),
    listPeers: vi.fn(async () => [testPeer]),
    updatePeerStatus: vi.fn(async () => true),
    sendDocument: vi.fn(async () => { throw new Error('not used'); }),
    receiveDocument: vi.fn(async () => { throw new Error('not used'); }),
    listTransfers: vi.fn(async () => []),
    peerHealth: vi.fn(async () => [testHealthEntry]),
    pingPeer: vi.fn(async () => testPingResult),
    ...overrides,
  };
}

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
  app.use('/api/federation', createFederationHealthRoutes({ federation: fed, permissions }));
  return app;
}

describe('federation health routes', () => {
  let permissions: PermissionsModule;

  beforeEach(() => {
    permissions = createPermissions();
  });

  describe('GET /api/federation/peers/health', () => {
    it('returns health entries for all peers', async () => {
      const fed = createInMemoryFederation();
      const app = createTestApp(fed, permissions);

      const res = await request(app).get('/api/federation/peers/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].peer.id).toBe(testPeer.id);
      expect(res.body[0].connectionStatus).toBe('connected');
      expect(res.body[0].conflictCount).toBe(2);
      expect(res.body[0].failedRequestCount).toBe(1);
      expect(res.body[0].lastSuccessfulSyncAt).toBe('2026-05-01T09:00:00Z');
    });

    it('returns empty array when no peers are registered', async () => {
      const fed = createInMemoryFederation({ peerHealth: vi.fn(async () => []) });
      const app = createTestApp(fed, permissions);

      const res = await request(app).get('/api/federation/peers/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('reflects error connection status correctly', async () => {
      const errorEntry: PeerHealthEntry = {
        ...testHealthEntry,
        connectionStatus: 'error',
        failedRequestCount: 5,
        lastSuccessfulSyncAt: null,
      };
      const fed = createInMemoryFederation({ peerHealth: vi.fn(async () => [errorEntry]) });
      const app = createTestApp(fed, permissions);

      const res = await request(app).get('/api/federation/peers/health');

      expect(res.status).toBe(200);
      expect(res.body[0].connectionStatus).toBe('error');
      expect(res.body[0].lastSuccessfulSyncAt).toBeNull();
    });
  });

  describe('POST /api/federation/peers/:id/ping', () => {
    it('returns ping result with latency on success', async () => {
      const fed = createInMemoryFederation();
      const app = createTestApp(fed, permissions);

      const res = await request(app).post(`/api/federation/peers/${testPeer.id}/ping`);

      expect(res.status).toBe(200);
      expect(res.body.reachable).toBe(true);
      expect(res.body.latencyMs).toBe(42);
      expect(res.body.error).toBeNull();
    });

    it('returns unreachable result when peer is down', async () => {
      const failPing: PingResult = {
        peerId: testPeer.id,
        reachable: false,
        latencyMs: null,
        error: 'Connection refused',
      };
      const fed = createInMemoryFederation({ pingPeer: vi.fn(async () => failPing) });
      const app = createTestApp(fed, permissions);

      const res = await request(app).post(`/api/federation/peers/${testPeer.id}/ping`);

      expect(res.status).toBe(200);
      expect(res.body.reachable).toBe(false);
      expect(res.body.error).toBe('Connection refused');
    });
  });

  describe('GET /api/federation/health', () => {
    it('responds with ok status without authentication', async () => {
      const fed = createInMemoryFederation();
      const app = createTestApp(fed, permissions);

      const res = await request(app).get('/api/federation/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
