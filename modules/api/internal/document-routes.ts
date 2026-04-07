/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  listDocuments,
  createDocument,
  getDocument,
  deleteDocument,
  updateDocumentTitle,
  getTemplate,
} from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { CacheClient } from './redis.ts';
import { asyncHandler } from './async-handler.ts';

export type DocumentRoutesOptions = {
  permissions: PermissionsModule;
  cache?: CacheClient;
};

/**
 * Mount document CRUD routes onto a router.
 * Each route enforces authentication and permission checks.
 */
export function createDocumentRoutes(opts: DocumentRoutesOptions): Router {
  const router = Router();
  const { permissions, cache } = opts;

  // List documents — requires auth only (no specific resource)
  router.get('/', permissions.requireAuth, asyncHandler(async (_req: Request, res: Response) => {
    const docs = await listDocuments();
    res.json(docs);
  }));

  // Create document — requires auth, auto-grants owner role to creator
  // Accepts optional ?templateId= query param to pre-fill content from a template
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const title = req.body?.title || 'Untitled';
    const id = randomUUID();

    // If a templateId is provided, fetch the template content
    const templateId = req.query.templateId as string | undefined;
    let templateContent: Record<string, unknown> | null = null;
    if (templateId) {
      const template = await getTemplate(templateId);
      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      templateContent = template.content;
    }

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

    res.status(201).json({ ...doc, templateContent });
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
  // Enhanced: removes document, yjs_state, Redis cache, and permission grants
  router.delete('/:id', permissions.require('delete'), asyncHandler(async (req: Request, res: Response) => {
    const documentId = String(req.params.id);

    const deleted = await deleteDocument(documentId);
    if (!deleted) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Clean up Redis cache entries for this document
    if (cache) {
      try {
        await cache.del(`doc:${documentId}`, `yjs:${documentId}`);
      } catch {
        // Cache cleanup is best-effort; document is already deleted
      }
    }

    // Remove all permission grants for this document
    await permissions.grantStore.deleteByResource(documentId, 'document');

    res.json({
      deletedAt: new Date().toISOString(),
      documentId,
      scope: 'full',
    });
  }));

  return router;
}
