/** Contract: contracts/federation/rules.md */
import { Router, type Request, type Response } from 'express';
import type { FederationModule } from '../contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

export interface FederationHealthRoutesOptions {
  federation: FederationModule;
  permissions: PermissionsModule;
}

/**
 * Health-specific federation routes, split from the main router to keep
 * each file under 200 lines.
 */
export function createFederationHealthRoutes(opts: FederationHealthRoutesOptions): Router {
  const { federation, permissions } = opts;
  const router = Router();

  // GET /api/federation/peers/health — aggregated health metrics for all peers
  router.get(
    '/peers/health',
    permissions.requireAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const health = await federation.peerHealth();
      res.json(health);
    }),
  );

  // POST /api/federation/peers/:id/ping — manually ping a peer to test reachability
  router.post(
    '/peers/:id/ping',
    permissions.requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const result = await federation.pingPeer(String(req.params.id));
      res.json(result);
    }),
  );

  // GET /api/federation/health — liveness probe used by peer pings (no auth — peers call this)
  router.get(
    '/health',
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    }),
  );

  return router;
}
