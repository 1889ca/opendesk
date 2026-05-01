/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import type { GrantStore } from '../../permissions/index.ts';
import type { SseFanout } from './sse-fanout.ts';

const KEEPALIVE_INTERVAL_MS = 15_000;

/**
 * Create the SSE event stream router.
 *
 * GET /api/events/stream
 *
 * Opens a text/event-stream connection for the authenticated principal.
 * Events are filtered to those the principal has access to:
 * - Document events (DocumentUpdated, StateFlushed) — only for docs the
 *   principal holds a grant on, refreshed dynamically on grant changes.
 * - Grant events (GrantCreated, GrantRevoked) — only those where:
 *   - revisionId (granteeId) === principalId (you are the grantee), OR
 *   - actorId (grantedBy) === principalId (you are the granter)
 *
 * The fanout hub receives all events from the single EventBus consumer
 * group and this handler decides which to forward per-connection.
 */
export function createSSERoutes(fanout: SseFanout, grantStore: GrantStore): Router {
  const router = Router();

  router.get('/events/stream', async (req: Request, res: Response) => {
    if (!req.principal) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }

    // SSE headers — flush immediately so the client sees the connection
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const principalId = req.principal.id;

    // Build the set of doc IDs this principal may see.
    // Updated dynamically: GrantCreated adds, GrantRevoked removes.
    const grants = await grantStore.findByPrincipal(principalId);
    const allowedDocIds = new Set(
      grants.filter((g) => g.resourceType === 'document').map((g) => g.resourceId),
    );

    let eventId = 0;

    // Send a keepalive ping every 15 s to prevent proxy timeouts
    const pingTimer = setInterval(() => {
      res.write(': keepalive\n\n');
    }, KEEPALIVE_INTERVAL_MS);

    // Subscribe to the in-process fanout and filter events per principal
    const unsubscribe = fanout.on((event) => {
      const docId = event.aggregateId;

      // Grant events — only forward if this principal is involved as grantee or granter.
      // revisionId carries the granteeId by convention (set by the permissions emitter).
      // actorId carries the granterId (grantedBy).
      // Fix #506: never broadcast grant events to unrelated principals (IDOR oracle).
      if (event.type === 'GrantCreated' || event.type === 'GrantRevoked') {
        const isGrantee = event.revisionId === principalId;
        const isGranter = event.actorId === principalId;

        if (!isGrantee && !isGranter) return;

        // Fix #507: keep allowedDocIds in sync with live grant state.
        // aggregateId on grant events is the resourceId (docId).
        if (isGrantee) {
          if (event.type === 'GrantCreated') {
            allowedDocIds.add(docId);
          } else {
            // GrantRevoked: remove access and close the stream so the client
            // reconnects fresh (no longer able to subscribe to this doc).
            allowedDocIds.delete(docId);
            const data = JSON.stringify(event);
            res.write(`id: ${++eventId}\nevent: ${event.type}\ndata: ${data}\n\n`);
            // Tear down this SSE connection; the client must reconnect.
            clearInterval(pingTimer);
            unsubscribe();
            res.end();
            return;
          }
        }

        const data = JSON.stringify(event);
        res.write(`id: ${++eventId}\nevent: ${event.type}\ndata: ${data}\n\n`);
        return;
      }

      // Document events — only forward if the principal has a grant on this doc
      if (!allowedDocIds.has(docId)) return;

      const data = JSON.stringify(event);
      res.write(`id: ${++eventId}\nevent: ${event.type}\ndata: ${data}\n\n`);
    });

    // Cleanup when the client disconnects
    req.on('close', () => {
      clearInterval(pingTimer);
      unsubscribe();
    });
  });

  return router;
}
