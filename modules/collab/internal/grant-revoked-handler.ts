/** Contract: contracts/collab/rules.md */

import type { WebSocket } from 'ws';
import type { Hocuspocus } from '@hocuspocus/server';
import { EventType, type EventBus, type DomainEvent } from '../../events/index.ts';
import type { Principal } from '../../auth/contract.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('collab:grant-revoked');

const CONSUMER_GROUP = 'collab-grant-revoked';

/** Close code sent to clients when their grant is revoked. */
export const GRANT_REVOKED_CLOSE_CODE = 4403;
export const GRANT_REVOKED_CLOSE_REASON = 'grant_revoked';

/**
 * Minimal interface for finding connections by document and principal.
 * Implemented by the live Hocuspocus instance in production, and by
 * a simple in-memory registry in tests.
 */
export interface ConnectionFinder {
  /** Return all WebSocket handles for `principalId` on `docId`. */
  getConnections(docId: string, principalId: string): WebSocket[];
}

/**
 * ConnectionRegistry adapts a live Hocuspocus instance into a ConnectionFinder.
 *
 * Hocuspocus tracks connections on each Document in `document.connections`
 * (a Map<WebSocket, { connection: Connection }>). The Connection's `.context`
 * carries the principal set by `onAuthenticate`.
 *
 * This class reads that structure at event time — no separate tracking needed.
 */
export class HocuspocusConnectionFinder implements ConnectionFinder {
  constructor(private readonly hocuspocus: Hocuspocus) {}

  getConnections(docId: string, principalId: string): WebSocket[] {
    const doc = this.hocuspocus.documents.get(docId);
    if (!doc) return [];

    const result: WebSocket[] = [];
    for (const [ws, { connection }] of doc.connections) {
      const ctx = connection.context as { principal?: Principal };
      if (ctx?.principal?.id === principalId) {
        result.push(ws);
      }
    }
    return result;
  }
}

/**
 * Simple in-memory ConnectionFinder for tests — no Hocuspocus dependency.
 */
export class InMemoryConnectionFinder implements ConnectionFinder {
  // docId → principalId → Set<WebSocket>
  private readonly map = new Map<string, Map<string, Set<WebSocket>>>();

  add(docId: string, principalId: string, ws: WebSocket): void {
    let byPrincipal = this.map.get(docId);
    if (!byPrincipal) {
      byPrincipal = new Map();
      this.map.set(docId, byPrincipal);
    }
    let sockets = byPrincipal.get(principalId);
    if (!sockets) {
      sockets = new Set();
      byPrincipal.set(principalId, sockets);
    }
    sockets.add(ws);
  }

  getConnections(docId: string, principalId: string): WebSocket[] {
    return [...(this.map.get(docId)?.get(principalId) ?? [])];
  }
}

/**
 * Subscribe to GrantRevoked events on the given EventBus.
 *
 * When an event arrives, all WebSocket connections for the revoked
 * principal on the target document are closed with code 4403.
 *
 * The GrantRevoked DomainEvent carries:
 *   - aggregateId  → docId (document whose grant was revoked)
 *   - revisionId   → granteeId (the principal whose access was revoked)
 *
 * This is a one-way event subscription — collab never imports from
 * sharing or permissions directly (contracts/collab/rules.md boundary).
 */
export async function subscribeGrantRevoked(
  eventBus: EventBus,
  finder: ConnectionFinder,
): Promise<void> {
  await eventBus.subscribe(
    CONSUMER_GROUP,
    [EventType.GrantRevoked],
    async (event: DomainEvent) => {
      const docId = event.aggregateId;
      // granteeId is carried in revisionId by the permissions module emitter
      const granteeId = event.revisionId;

      if (!granteeId) {
        log.warn('GrantRevoked event missing granteeId (revisionId); skipping', {
          eventId: event.id,
          docId,
        });
        await eventBus.acknowledge(CONSUMER_GROUP, event.id);
        return;
      }

      const connections = finder.getConnections(docId, granteeId);

      if (connections.length > 0) {
        log.info('closing revoked connections', {
          docId,
          granteeId,
          count: connections.length,
        });
        for (const ws of connections) {
          ws.close(GRANT_REVOKED_CLOSE_CODE, GRANT_REVOKED_CLOSE_REASON);
        }
      } else {
        log.debug('GrantRevoked: no active connections to close', {
          docId,
          granteeId,
        });
      }

      await eventBus.acknowledge(CONSUMER_GROUP, event.id);
    },
  );
}
