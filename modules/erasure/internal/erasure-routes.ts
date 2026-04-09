/** Contract: contracts/erasure/rules.md */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  LegalBasisSchema,
  JurisdictionSchema,
  type ErasureModule,
} from '../contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

// --- Validation schemas ---

const ErasureRequestBody = z.object({
  documentId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const CreatePolicyBody = z.object({
  name: z.string().min(1).max(200),
  target: z.enum(['kb_draft', 'kb_published', 'document_draft', 'tombstone']),
  maxAgeDays: z.coerce.number().int().positive(),
  enabled: z.boolean().default(false),
});

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

const ReleaseHoldBody = z.object({ releasedBy: z.string().min(1) });
const PolicyQuery = z.object({ jurisdiction: JurisdictionSchema, legalBasis: LegalBasisSchema });

export interface ErasureRoutesOptions {
  erasure: ErasureModule;
  permissions: PermissionsModule;
}

/** Mount erasure routes. All routes require manage-level permissions. */
export function createErasureRoutes(opts: ErasureRoutesOptions): Router {
  const { erasure, permissions } = opts;
  const router = Router();

  // --- Basic erasure routes ---

  router.post('/erase', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const parsed = ErasureRequestBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues }); return; }
    const principal = req.principal!;
    const allowed = await permissions.checkPermission(principal.id, parsed.data.documentId, 'manage');
    if (!allowed) { res.status(403).json({ error: 'Forbidden' }); return; }
    const attestation = await erasure.eraseDocument(parsed.data.documentId, principal.id, 'human', parsed.data.reason);
    res.status(201).json(attestation);
  }));

  router.get('/attestations/:documentId', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const documentId = String(req.params.documentId);
    const principal = req.principal!;
    const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
    if (!allowed) { res.status(403).json({ error: 'Forbidden' }); return; }
    res.json(await erasure.getAttestations(documentId));
  }));

  router.post('/policies', permissions.requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreatePolicyBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues }); return; }
    const policy = await erasure.createPolicy({ ...parsed.data, updatedAt: new Date().toISOString() });
    res.status(201).json(policy);
  }));

  router.get('/policies', permissions.requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
    res.json(await erasure.listPolicies());
  }));

  router.delete('/policies/:id', permissions.requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const deleted = await erasure.deletePolicy(String(req.params.id));
    if (!deleted) { res.status(404).json({ error: 'Policy not found' }); return; }
    res.json({ ok: true });
  }));

  router.get('/scan', permissions.requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
    res.json(await erasure.scanRetention());
  }));

  router.post('/execute', permissions.requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const principal = req.principal!;
    const attestations = await erasure.executeRetention(principal.id);
    res.json({ executed: attestations.length, attestations });
  }));

  // --- Bridge routes ---

  router.post('/bridges', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateBridgeBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues }); return; }
    const principal = req.principal!;
    const bridge = await erasure.createBridge({ ...parsed.data, jurisdiction: parsed.data.jurisdiction ?? null, actorId: principal.id });
    res.status(201).json(bridge);
  }));

  router.get('/verify/:documentId', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const documentId = String(req.params.documentId);
    const principal = req.principal!;
    const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
    if (!allowed) { res.status(403).json({ error: 'Forbidden' }); return; }
    res.json(await erasure.verifyChain(documentId));
  }));

  router.get('/proof/:documentId/:entryId', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const documentId = String(req.params.documentId);
    const entryId = String(req.params.entryId);
    const principal = req.principal!;
    const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
    if (!allowed) { res.status(403).json({ error: 'Forbidden' }); return; }
    res.json(await erasure.generateProof(documentId, entryId));
  }));

  router.post('/proof/verify', asyncHandler(async (req: Request, res: Response) => {
    res.json({ valid: erasure.verifyProof(req.body) });
  }));

  router.get('/conflicts/:documentId', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const documentId = String(req.params.documentId);
    const principal = req.principal!;
    const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
    if (!allowed) { res.status(403).json({ error: 'Forbidden' }); return; }
    const conflicts = await erasure.checkConflicts(documentId);
    res.json({ conflicts, hasBlockingConflicts: conflicts.some((c) => c.blocking) });
  }));

  // --- Legal hold routes ---

  router.post('/holds', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateHoldBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues }); return; }
    const principal = req.principal!;
    const hold = await erasure.createHold({ ...parsed.data, actorId: principal.id });
    res.status(201).json(hold);
  }));

  router.get('/holds/:documentId', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const documentId = String(req.params.documentId);
    const principal = req.principal!;
    const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
    if (!allowed) { res.status(403).json({ error: 'Forbidden' }); return; }
    res.json(await erasure.getActiveHolds(documentId));
  }));

  router.post('/holds/:holdId/release', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const parsed = ReleaseHoldBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues }); return; }
    res.json(await erasure.releaseHold(String(req.params.holdId), parsed.data.releasedBy));
  }));

  router.get('/policy', asyncHandler(async (req: Request, res: Response) => {
    const parsed = PolicyQuery.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues }); return; }
    res.json(erasure.getPolicy(parsed.data.jurisdiction, parsed.data.legalBasis));
  }));

  return router;
}
