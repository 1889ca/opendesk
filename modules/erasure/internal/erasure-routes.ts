/** Contract: contracts/erasure/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { ErasureModule } from '../contract.ts';
import { asyncHandler } from '../../api/index.ts';

export type ErasureRoutesOptions = {
  permissions: PermissionsModule;
  erasureModule: ErasureModule;
};

const RedactBody = z.object({
  userId: z.string().optional(),
  pattern: z.string().optional(),
  legalBasis: z.string().min(1),
}).refine(
  (d) => d.userId || d.pattern,
  { message: 'Either userId or pattern must be provided' },
);

const AnonymizeBody = z.object({
  targetUserId: z.string().min(1),
  legalBasis: z.string().min(1),
});

const CascadeBody = z.object({
  legalBasis: z.string().min(1),
});

const PolicyBody = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  target: z.enum(['kb_draft', 'kb_published', 'document_draft', 'tombstone']),
  maxAgeDays: z.number().int().positive(),
  enabled: z.boolean().default(true),
});

/**
 * Mount erasure routes onto a router.
 * All routes require manage-level permission.
 */
export function createErasureRoutes(opts: ErasureRoutesOptions): Router {
  const router = Router();
  const { permissions, erasureModule } = opts;

  // POST /documents/:id/tombstones -- extract tombstones
  router.post(
    '/documents/:id/tombstones',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const docId = String(req.params.id);
      const report = await erasureModule.extractTombstones(docId, new Uint8Array());
      res.json(report);
    }),
  );

  // POST /documents/:id/anonymize -- anonymize document
  router.post(
    '/documents/:id/anonymize',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const body = AnonymizeBody.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: 'Validation failed', issues: body.error.issues });
        return;
      }
      const principal = (req as any).principal;
      const docId = String(req.params.id);
      const result = await erasureModule.anonymizeDocument(
        docId, body.data.targetUserId, body.data.legalBasis, principal.id,
      );
      res.json({ docId: result.docId, targetUserId: result.targetUserId, itemsAnonymized: result.itemsAnonymized });
    }),
  );

  // POST /documents/:id/redact -- redact content
  router.post(
    '/documents/:id/redact',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const body = RedactBody.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: 'Validation failed', issues: body.error.issues });
        return;
      }
      const principal = (req as any).principal;
      const docId = String(req.params.id);
      const result = await erasureModule.redactContent(docId, {
        ...body.data,
        requestedBy: principal.id,
      });
      res.json(result);
    }),
  );

  // POST /kb/:entryId/cascade-erase -- cascade erase KB entry
  router.post(
    '/kb/:entryId/cascade-erase',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const body = CascadeBody.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: 'Validation failed', issues: body.error.issues });
        return;
      }
      const principal = (req as any).principal;
      const entryId = String(req.params.entryId);
      const result = await erasureModule.cascadeEraseKbEntry(
        entryId, body.data.legalBasis, principal.id,
      );
      res.json(result);
    }),
  );

  // GET /retention/policies -- list retention policies
  router.get(
    '/retention/policies',
    permissions.require('manage'),
    asyncHandler(async (_req: Request, res: Response) => {
      const policies = await erasureModule.listPolicies();
      res.json(policies);
    }),
  );

  // PUT /retention/policies -- upsert retention policy
  router.put(
    '/retention/policies',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const body = PolicyBody.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: 'Validation failed', issues: body.error.issues });
        return;
      }
      const now = new Date().toISOString();
      const policy = await erasureModule.upsertPolicy({
        ...body.data,
        createdAt: now,
        updatedAt: now,
      });
      res.json(policy);
    }),
  );

  // POST /retention/policies/:id/preview -- dry-run prune
  router.post(
    '/retention/policies/:id/preview',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const policyId = String(req.params.id);
      const preview = await erasureModule.previewPrune(policyId);
      res.json(preview);
    }),
  );

  // POST /retention/policies/:id/execute -- execute prune
  router.post(
    '/retention/policies/:id/execute',
    permissions.require('manage'),
    asyncHandler(async (req: Request, res: Response) => {
      const principal = (req as any).principal;
      const policyId = String(req.params.id);
      const result = await erasureModule.executePrune(policyId, principal.id);
      res.json(result);
    }),
  );

  return router;
}
