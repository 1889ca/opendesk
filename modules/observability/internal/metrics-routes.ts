/** Contract: contracts/observability/rules.md */
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import type { ObservabilityModule } from '../contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

export interface MetricsRoutesOptions {
  observability: ObservabilityModule;
  permissions: PermissionsModule;
  pool: Pool;
}

/**
 * Mount metrics routes under /api/admin/metrics.
 * Requires authentication (admin access).
 */
export function createMetricsRoutes(opts: MetricsRoutesOptions): Router {
  const { observability, permissions, pool } = opts;
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

  // GET /api/admin/metrics/audit — audit chain health summary
  router.get(
    '/audit',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const result = await pool.query(`
        SELECT
          COUNT(*)::int AS "totalEntries",
          COUNT(DISTINCT document_id)::int AS "documentsTracked",
          MAX(created_at) AS "lastEntryAt"
        FROM audit_log
      `);
      const row = result.rows[0] ?? { totalEntries: 0, documentsTracked: 0, lastEntryAt: null };
      res.json({
        totalEntries: row.totalEntries,
        documentsTracked: row.documentsTracked,
        lastEntryAt: row.lastEntryAt ? new Date(row.lastEntryAt).toISOString() : null,
      });
    }),
  );

  return router;
}
