/** Contract: contracts/audit/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { AuditModule } from '../contract.ts';
import { asyncHandler } from '../../api/index.ts';
import { exportAuditProof, exportAuditProofSummary, verifyAuditProof, type AuditProof } from './proof-export.ts';

const LogQueryParams = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

export type AuditRoutesOptions = {
  permissions: PermissionsModule;
  auditModule: AuditModule;
  pool?: import('pg').Pool;
  hmacSecret?: string;
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
      const principal = req.principal!;
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

  // Point-in-Time Verifiability (Pillar 2 M2)
  // These endpoints require pool and hmacSecret to be provided.
  if (opts.pool && opts.hmacSecret) {
    const { pool: auditPool, hmacSecret } = opts;

    // GET /proof/:documentId — full exportable audit proof bundle
    router.get(
      '/proof/:documentId',
      permissions.requireForResource('manage', 'document'),
      asyncHandler(async (req: Request, res: Response) => {
        const documentId = String(req.params.documentId);
        const principal = req.principal!;
        const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
        if (!allowed) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }

        const proof = await exportAuditProof(auditPool, documentId, hmacSecret);
        res.json(proof);
      }),
    );

    // GET /proof/:documentId/summary — lightweight proof summary
    router.get(
      '/proof/:documentId/summary',
      permissions.requireForResource('manage', 'document'),
      asyncHandler(async (req: Request, res: Response) => {
        const documentId = String(req.params.documentId);
        const principal = req.principal!;
        const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
        if (!allowed) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }

        const summary = await exportAuditProofSummary(auditPool, documentId, hmacSecret);
        res.json(summary);
      }),
    );

    // POST /proof/verify — verify a proof bundle offline (stateless)
    router.post(
      '/proof/verify',
      permissions.requireAuth,
      asyncHandler(async (req: Request, res: Response) => {
        const body = req.body as { proof?: AuditProof; hmacSecret?: string };
        if (!body.proof || !body.hmacSecret) {
          res.status(400).json({ error: 'proof and hmacSecret are required' });
          return;
        }
        const result = verifyAuditProof(body.proof, body.hmacSecret);
        res.json(result);
      }),
    );
  }

  return router;
}
