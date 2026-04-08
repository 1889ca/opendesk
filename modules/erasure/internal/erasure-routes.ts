/** Contract: contracts/erasure/rules.md */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { ErasureModule } from '../contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

const ErasureRequestBody = z.object({
  documentId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const CreatePolicyBody = z.object({
  name: z.string().min(1).max(200),
  documentType: z.string().default('*'),
  maxAgeDays: z.coerce.number().int().positive(),
  autoPurge: z.boolean().default(false),
});

export interface ErasureRoutesOptions {
  erasure: ErasureModule;
  permissions: PermissionsModule;
}

/**
 * Mount erasure routes under /api/erasure.
 * All routes require manage-level permissions.
 */
export function createErasureRoutes(opts: ErasureRoutesOptions): Router {
  const { erasure, permissions } = opts;
  const router = Router();

  // POST /api/erasure/erase — erase a document's CRDT history
  router.post(
    '/erase',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = ErasureRequestBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      const principal = req.principal!;
      const allowed = await permissions.checkPermission(
        principal.id,
        parsed.data.documentId,
        'manage',
      );
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const attestation = await erasure.eraseDocument(
        parsed.data.documentId,
        principal.id,
        'human',
        parsed.data.reason,
      );
      res.status(201).json(attestation);
    }),
  );

  // GET /api/erasure/attestations/:documentId — get erasure attestations
  router.get(
    '/attestations/:documentId',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = String(req.params.documentId);
      const principal = req.principal!;
      const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const attestations = await erasure.getAttestations(documentId);
      res.json(attestations);
    }),
  );

  // POST /api/erasure/policies — create a retention policy
  router.post(
    '/policies',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CreatePolicyBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      const principal = req.principal!;
      const policy = await erasure.createPolicy({
        ...parsed.data,
        createdBy: principal.id,
      });
      res.status(201).json(policy);
    }),
  );

  // GET /api/erasure/policies — list retention policies
  router.get(
    '/policies',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const policies = await erasure.listPolicies();
      res.json(policies);
    }),
  );

  // DELETE /api/erasure/policies/:id — delete a retention policy
  router.delete(
    '/policies/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const deleted = await erasure.deletePolicy(String(req.params.id));
      if (!deleted) {
        res.status(404).json({ error: 'Policy not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  // GET /api/erasure/scan — scan for documents matching retention policies (dry run)
  router.get(
    '/scan',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const results = await erasure.scanRetention();
      res.json(results);
    }),
  );

  // POST /api/erasure/execute — execute retention (auto-purge matching documents)
  router.post(
    '/execute',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const principal = req.principal!;
      const attestations = await erasure.executeRetention(principal.id);
      res.json({ executed: attestations.length, attestations });
    }),
  );

  return router;
}
