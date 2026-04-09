/** Contract: contracts/erasure/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { ErasureModule } from '../contract.ts';
import { LegalBasisSchema, JurisdictionSchema } from '../contract.ts';
import { asyncHandler } from '../../api/index.ts';

export type ErasureRoutesOptions = {
  permissions: PermissionsModule;
  erasureModule: ErasureModule;
};

const CreateBridgeBody = z.object({
  documentId: z.string().min(1),
  attestationId: z.string().min(1),
  preErasureHash: z.string().regex(/^[0-9a-f]{64}$/i),
  postErasureHash: z.string().regex(/^[0-9a-f]{64}$/i),
  legalBasis: LegalBasisSchema,
  jurisdiction: JurisdictionSchema.nullable().optional(),
});

const CreateHoldBody = z.object({
  documentId: z.string().min(1),
  holdType: z.enum(['litigation', 'regulatory', 'ediscovery']),
  authority: z.string().min(1),
  reason: z.string().optional(),
  expiresAt: z.string().optional(),
});

const ReleaseHoldBody = z.object({
  releasedBy: z.string().min(1),
});

const PolicyQuery = z.object({
  jurisdiction: JurisdictionSchema,
  legalBasis: LegalBasisSchema,
});

/**
 * Mount erasure routes onto a router.
 * All routes require manage-level permission.
 */
export function createErasureRoutes(opts: ErasureRoutesOptions): Router {
  const router = Router();
  const { permissions, erasureModule } = opts;

  // POST /erasure/bridges — create an erasure bridge
  router.post(
    '/erasure/bridges',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CreateBridgeBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }
      const principal = (req as any).principal;
      const bridge = await erasureModule.createBridge({
        ...parsed.data,
        jurisdiction: parsed.data.jurisdiction ?? null,
        actorId: principal.id,
      });
      res.status(201).json(bridge);
    }),
  );

  // GET /erasure/verify/:documentId — verify chain with erasure awareness
  router.get(
    '/erasure/verify/:documentId',
    permissions.requireForResource('manage', 'document'),
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = String(req.params['documentId']);
      const principal = (req as any).principal;
      const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const result = await erasureModule.verifyChain(documentId);
      res.json(result);
    }),
  );

  // GET /erasure/proof/:documentId/:entryId — generate selective disclosure proof
  router.get(
    '/erasure/proof/:documentId/:entryId',
    permissions.requireForResource('manage', 'document'),
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = String(req.params['documentId']);
      const entryId = String(req.params['entryId']);
      const principal = (req as any).principal;
      const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const proof = await erasureModule.generateProof(documentId, entryId);
      res.json(proof);
    }),
  );

  // POST /erasure/proof/verify — verify a selective disclosure proof
  router.post(
    '/erasure/proof/verify',
    asyncHandler(async (req: Request, res: Response) => {
      const valid = erasureModule.verifyProof(req.body);
      res.json({ valid });
    }),
  );

  // GET /erasure/conflicts/:documentId — check for erasure conflicts
  router.get(
    '/erasure/conflicts/:documentId',
    permissions.requireForResource('manage', 'document'),
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = String(req.params['documentId']);
      const principal = (req as any).principal;
      const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const conflicts = await erasureModule.checkConflicts(documentId);
      res.json({ conflicts, hasBlockingConflicts: conflicts.some((c) => c.blocking) });
    }),
  );

  // POST /erasure/holds — create a legal hold
  router.post(
    '/erasure/holds',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CreateHoldBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }
      const principal = (req as any).principal;
      const hold = await erasureModule.createHold({
        ...parsed.data,
        actorId: principal.id,
      });
      res.status(201).json(hold);
    }),
  );

  // GET /erasure/holds/:documentId — get active holds for a document
  router.get(
    '/erasure/holds/:documentId',
    permissions.requireForResource('manage', 'document'),
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = String(req.params['documentId']);
      const principal = (req as any).principal;
      const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const holds = await erasureModule.getActiveHolds(documentId);
      res.json(holds);
    }),
  );

  // POST /erasure/holds/:holdId/release — release a legal hold
  router.post(
    '/erasure/holds/:holdId/release',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = ReleaseHoldBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }
      const hold = await erasureModule.releaseHold(String(req.params['holdId']), parsed.data.releasedBy);
      res.json(hold);
    }),
  );

  // GET /erasure/policy — get jurisdiction erasure policy
  router.get(
    '/erasure/policy',
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = PolicyQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }
      const policy = erasureModule.getPolicy(parsed.data.jurisdiction, parsed.data.legalBasis);
      res.json(policy);
    }),
  );

  return router;
}
