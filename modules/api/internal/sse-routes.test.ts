/** Contract: contracts/api/rules.md */

import { describe, it, expect } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'node:http';
import { createSSERoutes } from './sse-routes.ts';
import { createSseFanout } from './sse-fanout.ts';
import { createInMemoryGrantStore } from '../../permissions/index.ts';
import type { Principal } from '../../auth/contract.ts';
import type { DomainEvent } from '../../events/contract.ts';

function makePrincipal(id: string): Principal {
  return {
    id,
    actorType: 'human',
    displayName: id,
    email: `${id}@opendesk.local`,
    scopes: [],
  };
}

function makeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'DocumentUpdated',
    aggregateId: 'doc-123',
    actorId: 'user-alice',
    actorType: 'human',
    occurredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildApp(principal?: Principal) {
  const fanout = createSseFanout();
  const grantStore = createInMemoryGrantStore();

  const app = express();

  if (principal) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.principal = principal;
      next();
    });
  }

  app.use('/api', createSSERoutes(fanout, grantStore));

  return { app, fanout, grantStore };
}

/**
 * Helper: spin up an HTTP server, make a GET request to path,
 * collect chunks for `collectMs` milliseconds, then destroy the
 * request and close the server. Returns the raw accumulated text.
 */
function collectSseChunks(
  app: express.Application,
  path: string,
  collectMs: number,
  onConnected?: () => void,
): Promise<{ chunks: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      const chunks: Buffer[] = [];
      let headers: Record<string, string | string[] | undefined> = {};

      const req = http.get(`http://localhost:${port}${path}`, (res) => {
        headers = res.headers as Record<string, string | string[] | undefined>;

        // Signal that we're connected so the test can emit events
        onConnected?.();

        res.on('data', (chunk: Buffer) => chunks.push(chunk));

        // Collect for collectMs, then tear down
        setTimeout(() => {
          req.destroy();
          server.close(() =>
            resolve({ chunks: Buffer.concat(chunks).toString(), headers }),
          );
        }, collectMs);
      });

      req.on('error', (err) => {
        // ECONNRESET is expected when req.destroy() races a write
        if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
          server.close(() =>
            resolve({ chunks: Buffer.concat(chunks).toString(), headers }),
          );
        } else {
          reject(err);
        }
      });
    });
  });
}

describe('GET /api/events/stream', () => {
  describe('authentication', () => {
    it('returns 401 when no principal is set', async () => {
      const { app } = buildApp();

      // For a JSON 401 response supertest works fine — no keep-alive
      const { default: request } = await import('supertest');
      const res = await request(app).get('/api/events/stream');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'unauthenticated' });
    });
  });

  describe('SSE headers', () => {
    it('sets the correct SSE headers on an authenticated connection', async () => {
      const alice = makePrincipal('user-alice');
      const { app } = buildApp(alice);

      const { headers } = await collectSseChunks(app, '/api/events/stream', 150);

      expect(headers['content-type']).toMatch(/text\/event-stream/);
      expect(headers['cache-control']).toBe('no-cache');
      expect(headers['x-accel-buffering']).toBe('no');
    }, 5000);
  });

  describe('event fan-out', () => {
    it('delivers a document event to a subscribed principal who has a grant', async () => {
      const alice = makePrincipal('user-alice');
      const { app, fanout, grantStore } = buildApp(alice);

      await grantStore.create({
        principalId: 'user-alice',
        resourceId: 'doc-123',
        resourceType: 'document',
        role: 'editor',
        grantedBy: 'user-system',
      });

      const { chunks } = await collectSseChunks(
        app,
        '/api/events/stream',
        300,
        () => {
          // Emit after connection established — the SSE handler awaits
          // grantStore.findByPrincipal before subscribing to the fanout,
          // so give it a small delay.
          setTimeout(() => {
            fanout.emit(makeEvent({ aggregateId: 'doc-123', type: 'DocumentUpdated' }));
          }, 80);
        },
      );

      expect(chunks).toContain('event: DocumentUpdated');
      expect(chunks).toContain('doc-123');
    }, 5000);

    it('does not deliver a document event if the principal lacks a grant', async () => {
      const bob = makePrincipal('user-bob');
      const { app, fanout } = buildApp(bob);
      // Bob has no grants

      const { chunks } = await collectSseChunks(
        app,
        '/api/events/stream',
        300,
        () => {
          setTimeout(() => {
            fanout.emit(makeEvent({ aggregateId: 'doc-123', type: 'DocumentUpdated' }));
          }, 80);
        },
      );

      // Keepalive comments are OK; DocumentUpdated must NOT appear
      expect(chunks).not.toContain('event: DocumentUpdated');
    }, 5000);

    it('delivers grant events to all connected principals', async () => {
      const alice = makePrincipal('user-alice');
      const { app, fanout } = buildApp(alice);

      const { chunks } = await collectSseChunks(
        app,
        '/api/events/stream',
        300,
        () => {
          setTimeout(() => {
            fanout.emit(makeEvent({ aggregateId: 'grant-999', type: 'GrantCreated' }));
          }, 80);
        },
      );

      expect(chunks).toContain('event: GrantCreated');
    }, 5000);
  });

  describe('SseFanout unit', () => {
    it('delivers events to all registered listeners', () => {
      const fanout = createSseFanout();
      const received: DomainEvent[] = [];

      const unsub = fanout.on((e) => received.push(e));
      fanout.emit(makeEvent());

      expect(received).toHaveLength(1);
      unsub();

      fanout.emit(makeEvent());
      expect(received).toHaveLength(1); // unsubscribed; no new events
    });

    it('tracks listener count', () => {
      const fanout = createSseFanout();
      expect(fanout.listenerCount()).toBe(0);

      const unsub = fanout.on(() => {});
      expect(fanout.listenerCount()).toBe(1);

      unsub();
      expect(fanout.listenerCount()).toBe(0);
    });
  });
});
