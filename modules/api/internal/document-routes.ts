/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  listDocuments,
  createDocument,
  getDocument,
  deleteDocument,
  updateDocumentTitle,
  type DocumentType,
} from '../../storage/internal/pg.ts';
import type { PermissionsModule } from '../../permissions/index.ts';

const VALID_DOC_TYPES: DocumentType[] = ['text', 'spreadsheet', 'presentation'];

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
  router.get('/', permissions.requireAuth, async (_req: Request, res: Response) => {
    const docs = await listDocuments();
    res.json(docs);
  });

  // Create document — requires auth, auto-grants owner role to creator
  router.post('/', permissions.requireAuth, async (req: Request, res: Response) => {
    const title = req.body?.title || 'Untitled';
    const documentType: DocumentType = req.body?.documentType || 'text';
    if (!VALID_DOC_TYPES.includes(documentType)) {
      res.status(400).json({ error: `Invalid documentType. Must be one of: ${VALID_DOC_TYPES.join(', ')}` });
      return;
    }
    const id = randomUUID();
    const doc = await createDocument(id, title, documentType);

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
  });

  // Get document — requires read permission
  router.get('/:id', permissions.require('read'), async (req: Request, res: Response) => {
    const doc = await getDocument(String(req.params.id));
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(doc);
  });

  // Update document title — requires write permission
  router.patch('/:id', permissions.require('write'), async (req: Request, res: Response) => {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    await updateDocumentTitle(String(req.params.id), title);
    res.json({ ok: true });
  });

  // Delete document — requires delete permission
  router.delete('/:id', permissions.require('delete'), async (req: Request, res: Response) => {
    const deleted = await deleteDocument(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
