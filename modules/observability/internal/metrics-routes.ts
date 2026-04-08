/** Contract: contracts/observability/rules.md */
import { Router, type Request, type Response } from 'express';
import type { ObservabilityModule } from '../contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

export interface MetricsRoutesOptions {
  observability: ObservabilityModule;
  permissions: PermissionsModule;
}

/**
 * Mount metrics routes under /api/admin/metrics.
 * Requires authentication (admin access).
 */
export function createMetricsRoutes(opts: MetricsRoutesOptions): Router {
  const { observability, permissions } = opts;
  const router = Router();

  // GET /api/admin/metrics — full summary (operations + health)
  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const summary = await observability.getSummary();
      res.json(summary);
    }),
  );

  // GET /api/admin/metrics/health — health indicators only
  router.get(
    '/health',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const health = await observability.getHealth();
      res.json({ timestamp: new Date().toISOString(), indicators: health });
    }),
  );

  return router;
}
