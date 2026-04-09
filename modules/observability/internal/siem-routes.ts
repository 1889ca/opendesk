/** Contract: contracts/observability/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { PermissionsModule } from '../../permissions/index.ts';
import { SiemConfigSchema, SiemFormatSchema } from '../contract.ts';
import { listConfigs, getConfig, upsertConfig, deleteConfig } from './siem-config-store.ts';
import { asyncHandler } from '../../api/index.ts';

export type SiemRoutesOptions = {
  permissions: PermissionsModule;
  pool: Pool;
};

/** Mount SIEM configuration management routes. */
export function createSiemRoutes(opts: SiemRoutesOptions): Router {
  const router = Router();
  const { permissions, pool } = opts;

  // GET /configs — list all SIEM configs
  router.get(
    '/configs',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const configs = await listConfigs(pool);
      res.json(configs);
    }),
  );

  // GET /configs/:id — get single config
  router.get(
    '/configs/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const config = await getConfig(pool, String(req.params.id));
      if (!config) {
        res.status(404).json({ error: 'Config not found' });
        return;
      }
      res.json(config);
    }),
  );

  // PUT /configs/:id — create or update config
  router.put(
    '/configs/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = SiemConfigUpsertSchema.safeParse({
        ...req.body,
        id: req.params.id,
      });
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }
      await upsertConfig(pool, {
        ...parsed.data,
        createdAt: parsed.data.createdAt ?? new Date().toISOString(),
      });
      res.json({ ok: true });
    }),
  );

  // DELETE /configs/:id — remove config
  router.delete(
    '/configs/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const deleted = await deleteConfig(pool, String(req.params.id));
      if (!deleted) {
        res.status(404).json({ error: 'Config not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  return router;
}

const SiemConfigUpsertSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  format: SiemFormatSchema,
  mode: z.enum(['push', 'pull']),
  endpoint: z.string().url().optional(),
  filters: z.record(z.string()).optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
});
