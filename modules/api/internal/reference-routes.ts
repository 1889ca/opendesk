/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';
import {
  createReference,
  getReference,
  listReferences,
  updateReference,
  deleteReference,
} from '../../references/index.ts';
import { lookupDOI, lookupISBN } from '../../references/internal/doi-lookup.ts';

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
};

/**
 * Mount reference CRUD + lookup routes onto a router.
 */
export function createReferenceRoutes(opts: ReferenceRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  // List references — optional ?documentId= filter
  router.get('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const queryResult = ListReferencesQuery.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: queryResult.error.issues });
      return;
    }
    const workspaceId = '00000000-0000-0000-0000-000000000000'; // default workspace
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

  // Get single reference
  router.get('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
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
    const updated = await updateReference(String(req.params.id), bodyResult.data);
    if (!updated) {
      res.status(404).json({ error: 'Reference not found' });
      return;
    }
    res.json(updated);
  }));

  // Delete reference
  router.delete('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteReference(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Reference not found' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
