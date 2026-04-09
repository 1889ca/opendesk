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

/**
 * Mount reference CRUD + lookup routes onto a router.
 */
export function createReferenceRoutes(opts: ReferenceRoutesOptions): Router {
  const { permissions } = opts;
  const getReference = opts.store?.getReference ?? defaultGetReference;
  const router = Router();

  // List references — optional ?documentId= filter
  router.get('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const queryResult = ListReferencesQuery.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: queryResult.error.issues });
      return;
    }
    const workspaceId = '00000000-0000-0000-0000-000000000000'; // default workspace
    const principal = req.principal!;
    await ensureLibraryGrant(permissions.grantStore, principal.id, workspaceId);
    const canRead = await checkLibraryAccess(permissions.grantStore, principal.id, workspaceId, 'read');
    if (!canRead) {
      res.status(403).json({ error: 'No read access to reference library' });
      return;
    }
    const refs = await listReferences(queryResult.data.documentId ?? workspaceId);
    res.json(refs);
  }));

  // Create reference
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = CreateReferenceBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const id = randomUUID();
    const principal = req.principal!;
    const workspaceId = '00000000-0000-0000-0000-000000000000'; // default workspace
    await ensureLibraryGrant(permissions.grantStore, principal.id, workspaceId);
    const canWrite = await checkLibraryAccess(permissions.grantStore, principal.id, workspaceId, 'write');
    if (!canWrite) {
      res.status(403).json({ error: 'No write access to reference library' });
      return;
    }
    const ref = await createReference(id, workspaceId, principal.id, bodyResult.data);
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
    const principal = req.principal!;
    const workspaceId = '00000000-0000-0000-0000-000000000000';
    const canRead = await checkLibraryAccess(permissions.grantStore, principal.id, workspaceId, 'read');
    if (!canRead) {
      res.status(403).json({ error: 'No read access to reference library' });
      return;
    }
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
    const principal = req.principal!;
    const workspaceId = '00000000-0000-0000-0000-000000000000';
    const canWrite = await checkLibraryAccess(permissions.grantStore, principal.id, workspaceId, 'write');
    if (!canWrite) {
      res.status(403).json({ error: 'No write access to reference library' });
      return;
    }
    const updated = await updateReference(String(req.params.id), bodyResult.data);
    if (!updated) {
      res.status(404).json({ error: 'Reference not found' });
      return;
    }
    res.json(updated);
  }));

  // Delete reference
  router.delete('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const principal = req.principal!;
    const workspaceId = '00000000-0000-0000-0000-000000000000';
    const canDelete = await checkLibraryAccess(permissions.grantStore, principal.id, workspaceId, 'delete');
    if (!canDelete) {
      res.status(403).json({ error: 'No delete access to reference library' });
      return;
    }
    const deleted = await deleteReference(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Reference not found' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
