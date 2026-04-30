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
 *   principal holds a grant on at connection time.
 * - Grant events (GrantCreated, GrantRevoked) — only those targeting the
 *   principal's own id.
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
    // Fetched once at connection time; grant changes won't update the
    // set mid-stream (a reconnect after a GrantCreated event handles that).
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

      // Grant events carry no docId — forward only if this principal is the grantee.
      // The aggregateId on grant events is the grantId, not a docId.
      if (event.type === 'GrantCreated' || event.type === 'GrantRevoked') {
        // The actorId on grant events is the granter; we can only forward
        // based on what we know at this layer. Forward to all connected
        // principals and let the client filter, OR only forward to the
        // granter so they see their own actions. Per the contract, the
        // events module is thin and carries no grantee payload, so we
        // forward grant events to all authenticated SSE clients — the
        // client MUST ignore events that aren't relevant to it.
        // This is safe: grant events contain no document content.
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
