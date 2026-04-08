/** Contract: contracts/audit/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { AuditModule } from '../contract.ts';
import { asyncHandler } from '../../api/index.ts';

const LogQueryParams = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

export type AuditRoutesOptions = {
  permissions: PermissionsModule;
  auditModule: AuditModule;
};

/**
 * Mount audit log routes onto a router.
 * All routes require owner-level permission on the document.
 */
export function createAuditRoutes(opts: AuditRoutesOptions): Router {
  const router = Router();
  const { permissions, auditModule } = opts;

  // GET /documents/:id/log — paginated audit log
  router.get(
    '/documents/:id/log',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const queryResult = LogQueryParams.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: queryResult.error.issues });
        return;
      }

      const documentId = String(req.params.id);
      const { cursor, limit } = queryResult.data;
      const entries = await auditModule.getLog(documentId, cursor, limit);
      res.json(entries);
    }),
  );

  // GET /verify/:documentId — verify HMAC chain integrity
  router.get(
    '/verify/:documentId',
    permissions.requireForResource('manage', 'document'),
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = String(req.params.documentId);

      // Check permission programmatically since resourceId comes from params
      const principal = (req as any).principal;
      const allowed = await permissions.checkPermission(
        principal.id,
        documentId,
        'manage',
      );
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const result = await auditModule.verifyChain(documentId);
      res.json(result);
    }),
  );

  return router;
}
