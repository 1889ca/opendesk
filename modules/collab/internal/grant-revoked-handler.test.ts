/** Contract: contracts/collab/rules.md */
import { describe, it, expect } from 'vitest';
import type { WebSocket } from 'ws';
import {
  InMemoryConnectionFinder,
  subscribeGrantRevoked,
  GRANT_REVOKED_CLOSE_CODE,
  GRANT_REVOKED_CLOSE_REASON,
} from './grant-revoked-handler.ts';
import { EventType, type EventBus, type DomainEvent } from '../../events/index.ts';

// ---------------------------------------------------------------------------
// Helpers — minimal WebSocket stand-in (no mocks, real event tracking)
// ---------------------------------------------------------------------------

interface FakeWs {
  closeCode: number | null;
  closeReason: string | null;
  closeCallCount: number;
  close(code: number, reason: string): void;
  once(event: 'close', cb: () => void): void;
}

function createFakeWs(): FakeWs {
  return {
    closeCode: null,
    closeReason: null,
    closeCallCount: 0,
    close(code, reason) {
      this.closeCode = code;
      this.closeReason = reason;
      this.closeCallCount += 1;
    },
    once(_event: string, _cb: () => void) {
      // no-op in tests — we never trigger socket close events here
    },
  };
}

// ---------------------------------------------------------------------------
// Minimal EventBus stub — captures subscribe calls and lets tests fire events
// ---------------------------------------------------------------------------

function createTestEventBus(): {
  eventBus: EventBus;
  triggerEvent(event: DomainEvent): Promise<void>;
  acknowledgedIds: string[];
} {
  let capturedHandler: ((event: DomainEvent) => Promise<void>) | null = null;
  const acknowledgedIds: string[] = [];

  const eventBus: EventBus = {
    async emit() {},
    async subscribe(_group, _types, handler) {
      capturedHandler = handler;
    },
    async acknowledge(_group, eventId) {
      acknowledgedIds.push(eventId);
    },
    async registerEventType() {},
  };

  return {
    eventBus,
    async triggerEvent(event) {
      if (capturedHandler) await capturedHandler(event);
    },
    acknowledgedIds,
  };
}

function makeGrantRevokedEvent(
  docId: string,
  granteeId: string | undefined,
): DomainEvent {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    type: EventType.GrantRevoked,
    aggregateId: docId,
    revisionId: granteeId,
    actorId: 'grantor-user',
    actorType: 'system',
    occurredAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// InMemoryConnectionFinder tests
// ---------------------------------------------------------------------------

describe('InMemoryConnectionFinder', () => {
  it('add and getConnections returns registered sockets', () => {
    const finder = new InMemoryConnectionFinder();
    const ws = createFakeWs() as unknown as WebSocket;

    finder.add('doc-1', 'user-a', ws);

    const connections = finder.getConnections('doc-1', 'user-a');
    expect(connections).toHaveLength(1);
    expect(connections[0]).toBe(ws);
  });

  it('getConnections returns empty array when no connections registered', () => {
    const finder = new InMemoryConnectionFinder();
    expect(finder.getConnections('doc-1', 'user-a')).toHaveLength(0);
  });

  it('tracks multiple sockets for the same user+doc', () => {
    const finder = new InMemoryConnectionFinder();
    const ws1 = createFakeWs() as unknown as WebSocket;
    const ws2 = createFakeWs() as unknown as WebSocket;

    finder.add('doc-1', 'user-a', ws1);
    finder.add('doc-1', 'user-a', ws2);

    expect(finder.getConnections('doc-1', 'user-a')).toHaveLength(2);
  });

  it('isolates connections by docId', () => {
    const finder = new InMemoryConnectionFinder();
    const ws1 = createFakeWs() as unknown as WebSocket;
    const ws2 = createFakeWs() as unknown as WebSocket;

    finder.add('doc-1', 'user-a', ws1);
    finder.add('doc-2', 'user-a', ws2);

    expect(finder.getConnections('doc-1', 'user-a')).toHaveLength(1);
    expect(finder.getConnections('doc-2', 'user-a')).toHaveLength(1);
    expect(finder.getConnections('doc-1', 'user-a')[0]).toBe(ws1);
  });

  it('isolates connections by principalId', () => {
    const finder = new InMemoryConnectionFinder();
    const ws1 = createFakeWs() as unknown as WebSocket;
    const ws2 = createFakeWs() as unknown as WebSocket;

    finder.add('doc-1', 'user-a', ws1);
    finder.add('doc-1', 'user-b', ws2);

    expect(finder.getConnections('doc-1', 'user-a')).toHaveLength(1);
    expect(finder.getConnections('doc-1', 'user-b')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// subscribeGrantRevoked tests
// ---------------------------------------------------------------------------

describe('subscribeGrantRevoked', () => {
  it('closes connection with code 4403 when GrantRevoked event arrives', async () => {
    const finder = new InMemoryConnectionFinder();
    const { eventBus, triggerEvent, acknowledgedIds } = createTestEventBus();

    await subscribeGrantRevoked(eventBus, finder);

    const ws = createFakeWs();
    finder.add('doc-1', 'user-a', ws as unknown as WebSocket);

    await triggerEvent(makeGrantRevokedEvent('doc-1', 'user-a'));

    expect(ws.closeCode).toBe(GRANT_REVOKED_CLOSE_CODE);
    expect(ws.closeReason).toBe(GRANT_REVOKED_CLOSE_REASON);
    expect(ws.closeCallCount).toBe(1);
  });

  it('acknowledges the event after handling', async () => {
    const finder = new InMemoryConnectionFinder();
    const { eventBus, triggerEvent, acknowledgedIds } = createTestEventBus();

    await subscribeGrantRevoked(eventBus, finder);

    finder.add('doc-1', 'user-a', createFakeWs() as unknown as WebSocket);
    await triggerEvent(makeGrantRevokedEvent('doc-1', 'user-a'));

    expect(acknowledgedIds).toContain('00000000-0000-4000-a000-000000000001');
  });

  it('closes all connections for the revoked user on that document', async () => {
    const finder = new InMemoryConnectionFinder();
    const { eventBus, triggerEvent } = createTestEventBus();

    await subscribeGrantRevoked(eventBus, finder);

    const ws1 = createFakeWs();
    const ws2 = createFakeWs();
    finder.add('doc-1', 'user-a', ws1 as unknown as WebSocket);
    finder.add('doc-1', 'user-a', ws2 as unknown as WebSocket);

    await triggerEvent(makeGrantRevokedEvent('doc-1', 'user-a'));

    expect(ws1.closeCode).toBe(4403);
    expect(ws2.closeCode).toBe(4403);
  });

  it('does not close connections for other users on the same document', async () => {
    const finder = new InMemoryConnectionFinder();
    const { eventBus, triggerEvent } = createTestEventBus();

    await subscribeGrantRevoked(eventBus, finder);

    const revokedWs = createFakeWs();
    const innocentWs = createFakeWs();
    finder.add('doc-1', 'user-revoked', revokedWs as unknown as WebSocket);
    finder.add('doc-1', 'user-innocent', innocentWs as unknown as WebSocket);

    await triggerEvent(makeGrantRevokedEvent('doc-1', 'user-revoked'));

    expect(revokedWs.closeCode).toBe(4403);
    expect(innocentWs.closeCode).toBeNull();
  });

  it('does not close connections for the same user on a different document', async () => {
    const finder = new InMemoryConnectionFinder();
    const { eventBus, triggerEvent } = createTestEventBus();

    await subscribeGrantRevoked(eventBus, finder);

    const revokedWs = createFakeWs();
    const otherDocWs = createFakeWs();
    finder.add('doc-1', 'user-a', revokedWs as unknown as WebSocket);
    finder.add('doc-2', 'user-a', otherDocWs as unknown as WebSocket);

    // Revoke on doc-1 only
    await triggerEvent(makeGrantRevokedEvent('doc-1', 'user-a'));

    expect(revokedWs.closeCode).toBe(4403);
    expect(otherDocWs.closeCode).toBeNull();
  });

  it('is a no-op when no connections are registered for the revoked user', async () => {
    const finder = new InMemoryConnectionFinder();
    const { eventBus, triggerEvent, acknowledgedIds } = createTestEventBus();

    await subscribeGrantRevoked(eventBus, finder);

    // Should not throw even with no registered connections
    await expect(
      triggerEvent(makeGrantRevokedEvent('doc-1', 'user-nobody')),
    ).resolves.not.toThrow();

    // Event still acknowledged
    expect(acknowledgedIds).toContain('00000000-0000-4000-a000-000000000001');
  });

  it('skips gracefully when granteeId is missing from the event', async () => {
    const finder = new InMemoryConnectionFinder();
    const { eventBus, triggerEvent, acknowledgedIds } = createTestEventBus();

    await subscribeGrantRevoked(eventBus, finder);

    // Simulate an event without revisionId (granteeId)
    await expect(
      triggerEvent(makeGrantRevokedEvent('doc-1', undefined)),
    ).resolves.not.toThrow();

    // Still acknowledged so the consumer doesn't re-process it
    expect(acknowledgedIds).toContain('00000000-0000-4000-a000-000000000001');
  });
});
