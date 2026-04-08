/** Contract: contracts/ediscovery/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { EDiscoveryModule } from '../contract.ts';
import { ExportFormatSchema } from '../contract.ts';
import { asyncHandler } from '../../api/index.ts';

export type EDiscoveryRoutesOptions = {
  permissions: PermissionsModule;
  ediscovery: EDiscoveryModule;
};

const SarQuerySchema = z.object({
  userId: z.string().min(1),
  format: ExportFormatSchema.default('json'),
});

const FoiaQuerySchema = z.object({
  documentId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: ExportFormatSchema.default('json'),
});

/**
 * eDiscovery export routes. All require admin (manage) permission.
 */
export function createEDiscoveryRoutes(opts: EDiscoveryRoutesOptions): Router {
  const router = Router();
  const { permissions, ediscovery } = opts;

  // POST /sar — Subject Access Request export
  router.post(
    '/sar',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = SarQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      const { userId, format } = parsed.data;
      const result = await ediscovery.sarExport({ userId });
      const bundle = ediscovery.formatExport(result, format, 'sar');

      res.setHeader('Content-Type', bundle.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
      res.send(bundle.data);
    }),
  );

  // POST /foia — FOIA-style document history export
  router.post(
    '/foia',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = FoiaQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      const { documentId, startDate, endDate, format } = parsed.data;
      const result = await ediscovery.foiaExport({ documentId, startDate, endDate });
      const bundle = ediscovery.formatExport(result, format, 'foia');

      res.setHeader('Content-Type', bundle.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
      res.send(bundle.data);
    }),
  );

  // GET /sar/:userId — SAR export as JSON (convenience GET)
  router.get(
    '/sar/:userId',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = String(req.params.userId);
      const format = ExportFormatSchema.catch('json').parse(req.query.format);
      const result = await ediscovery.sarExport({ userId });

      if (format === 'json') {
        res.json(result);
        return;
      }

      const bundle = ediscovery.formatExport(result, format, 'sar');
      res.setHeader('Content-Type', bundle.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
      res.send(bundle.data);
    }),
  );

  // GET /foia/:documentId — FOIA export as JSON (convenience GET)
  router.get(
    '/foia/:documentId',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = String(req.params.documentId);
      const format = ExportFormatSchema.catch('json').parse(req.query.format);
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await ediscovery.foiaExport({ documentId, startDate, endDate });

      if (format === 'json') {
        res.json(result);
        return;
      }

      const bundle = ediscovery.formatExport(result, format, 'foia');
      res.setHeader('Content-Type', bundle.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
      res.send(bundle.data);
    }),
  );

  return router;
}
