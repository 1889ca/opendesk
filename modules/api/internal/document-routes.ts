/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  listDocuments,
  createDocument,
  getDocument,
  deleteDocument,
  updateDocumentTitle,
} from '../../storage/internal/pg.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';

export type DocumentRoutesOptions = {
  permissions: PermissionsModule;
};

/**
 * Mount document CRUD routes onto a router.
 * Each route enforces authentication and permission checks.
 */
export function createDocumentRoutes(opts: DocumentRoutesOptions): Router {
  const router = Router();
  const { permissions } = opts;

  // List documents — requires auth only (no specific resource)
  router.get('/', permissions.requireAuth, asyncHandler(async (_req: Request, res: Response) => {
    const docs = await listDocuments();
    res.json(docs);
  }));

  // Create document — requires auth, auto-grants owner role to creator
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const title = req.body?.title || 'Untitled';
    const id = randomUUID();
    const doc = await createDocument(id, title);

    // Auto-grant owner role to document creator
    const principal = req.principal!;
    await permissions.grantStore.create({
      principalId: principal.id,
      resourceId: id,
      resourceType: 'document',
      role: 'owner',
      grantedBy: principal.id,
    });

    res.status(201).json(doc);
  }));

  // Get document — requires read permission
  router.get('/:id', permissions.require('read'), asyncHandler(async (req: Request, res: Response) => {
    const doc = await getDocument(String(req.params.id));
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(doc);
  }));

  // Update document title — requires write permission
  router.patch('/:id', permissions.require('write'), asyncHandler(async (req: Request, res: Response) => {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    await updateDocumentTitle(String(req.params.id), title);
    res.json({ ok: true });
  }));

  // Delete document — requires delete permission
  router.delete('/:id', permissions.require('delete'), asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteDocument(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
