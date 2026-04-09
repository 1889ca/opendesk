/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';
import {
  createReference,
  getReference as defaultGetReference,
  listReferences,
  updateReference,
  deleteReference,
  lookupDOI,
  lookupISBN,
  ensureLibraryGrant,
  checkLibraryAccess,
} from '../../references/index.ts';

/**
 * Minimal injectable surface for the references store. Defaults to the
 * pg-backed implementation; tests inject in-memory functions to avoid
 * mocking pg or coupling route tests to the database layer.
 */
export type ReferenceLookupFns = {
  getReference: typeof defaultGetReference;
};

const CreateReferenceBody = z.object({
  title: z.string().min(1).max(500),
  authors: z.array(z.string()).default([]),
  year: z.number().int().nullable().default(null),
  source: z.string().max(500).nullable().default(null),
  volume: z.string().max(100).nullable().default(null),
  issue: z.string().max(100).nullable().default(null),
  pages: z.string().max(100).nullable().default(null),
  doi: z.string().max(200).nullable().default(null),
  isbn: z.string().max(50).nullable().default(null),
  url: z.string().url().max(2000).nullable().default(null),
  publisher: z.string().max(500).nullable().default(null),
  type: z.enum(['article', 'book', 'chapter', 'website', 'other']).default('other'),
});

const UpdateReferenceBody = z.object({
  title: z.string().min(1).max(500).optional(),
  authors: z.array(z.string()).optional(),
  year: z.number().int().nullable().optional(),
  source: z.string().max(500).nullable().optional(),
  volume: z.string().max(100).nullable().optional(),
  issue: z.string().max(100).nullable().optional(),
  pages: z.string().max(100).nullable().optional(),
  doi: z.string().max(200).nullable().optional(),
  isbn: z.string().max(50).nullable().optional(),
  url: z.string().url().max(2000).nullable().optional(),
  publisher: z.string().max(500).nullable().optional(),
  type: z.enum(['article', 'book', 'chapter', 'website', 'other']).optional(),
});

const ListReferencesQuery = z.object({
  documentId: z.string().uuid().optional(),
});

export type ReferenceRoutesOptions = {
  permissions: PermissionsModule;
  /**
   * Optional override for the references store lookup functions.
   * Production wires the pg-backed defaults; tests inject in-memory
   * functions so the route's auth/permission gates can be exercised
   * without a database.
   */
  store?: Partial<ReferenceLookupFns>;
};

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Mount reference CRUD + lookup routes onto a router.
 */
export function createReferenceRoutes(opts: ReferenceRoutesOptions): Router {
  const { permissions } = opts;
  const getReference = opts.store?.getReference ?? defaultGetReference;
  const router = Router();

  /**
   * Gate the request on the principal's access to the default
   * reference library workspace. Returns true if access was granted;
   * if false, the response has already been sent (403) and the
   * caller should return immediately.
   */
  async function gateLibrary(
    req: Request,
    res: Response,
    action: 'read' | 'write' | 'delete',
    ensureGrant = false,
  ): Promise<boolean> {
    const principal = req.principal!;
    if (ensureGrant) {
      await ensureLibraryGrant(permissions.grantStore, principal.id, DEFAULT_WORKSPACE_ID);
    }
    const allowed = await checkLibraryAccess(permissions.grantStore, principal.id, DEFAULT_WORKSPACE_ID, action);
    if (!allowed) {
      res.status(403).json({ error: `No ${action} access to reference library` });
      return false;
    }
    return true;
  }

  // List references — optional ?documentId= filter
  router.get('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const queryResult = ListReferencesQuery.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: queryResult.error.issues });
      return;
    }
    if (!await gateLibrary(req, res, 'read', /* ensureGrant */ true)) return;
    const refs = await listReferences(queryResult.data.documentId ?? DEFAULT_WORKSPACE_ID);
    res.json(refs);
  }));

  // Create reference
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = CreateReferenceBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    if (!await gateLibrary(req, res, 'write', /* ensureGrant */ true)) return;
    const id = randomUUID();
    const principal = req.principal!;
    const ref = await createReference(id, DEFAULT_WORKSPACE_ID, principal.id, bodyResult.data);
    res.status(201).json(ref);
  }));

  // DOI lookup — must be before /:id to avoid matching "lookup" as an id
  router.get('/lookup/doi/:doi', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const result = await lookupDOI(String(req.params.doi));
    if (!result.ok) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 502;
      res.status(status).json({ error: result.error.message, code: result.error.code });
      return;
    }
    res.json(result.data);
  }));

  // ISBN lookup
  router.get('/lookup/isbn/:isbn', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const result = await lookupISBN(String(req.params.isbn));
    if (!result.ok) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 502;
      res.status(status).json({ error: result.error.message, code: result.error.code });
      return;
    }
    res.json(result.data);
  }));

  // Get single reference — gated on workspace read access (issue #129).
  // Without this gate, any authenticated user could fetch any reference
  // by UUID, bypassing the workspace/library grant system.
  router.get('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    if (!await gateLibrary(req, res, 'read')) return;
    const ref = await getReference(String(req.params.id));
    if (!ref) {
      res.status(404).json({ error: 'Reference not found' });
      return;
    }
    res.json(ref);
  }));

  // Update reference
  router.patch('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = UpdateReferenceBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    if (!await gateLibrary(req, res, 'write')) return;
    const updated = await updateReference(String(req.params.id), bodyResult.data);
    if (!updated) {
      res.status(404).json({ error: 'Reference not found' });
      return;
    }
    res.json(updated);
  }));

  // Delete reference
  router.delete('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    if (!await gateLibrary(req, res, 'delete')) return;
    const deleted = await deleteReference(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Reference not found' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
