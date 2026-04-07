/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  listDocuments,
  createDocument,
  getDocument,
  deleteDocument,
  updateDocumentTitle,
  getTemplate,
  type DocumentType,
} from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { loadConfig } from '../../config/index.ts';
import type { CacheClient } from './redis.ts';
import { asyncHandler } from './async-handler.ts';

const ListDocumentsQuery = z.object({
  folderId: z.string().uuid().optional(),
});

const CreateDocumentBody = z.object({
  title: z.string().min(1).max(200).optional(),
});

const CreateDocumentQuery = z.object({
  templateId: z.string().uuid().optional(),
});

const UpdateDocumentBody = z.object({
  title: z.string().min(1).max(200),
});

const VALID_DOC_TYPES: DocumentType[] = ['text', 'spreadsheet', 'presentation'];

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

  // List documents — accepts optional ?folderId= to filter by folder
  // Filters results by principal's grants (except in dev mode)
  router.get('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const queryResult = ListDocumentsQuery.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: queryResult.error.issues });
      return;
    }
    const docs = await listDocuments(queryResult.data.folderId ?? null);

    if (loadConfig().auth.mode === 'dev') {
      res.json(docs);
      return;
    }

    const principal = req.principal!;
    const grants = await permissions.grantStore.findByPrincipal(principal.id);
    const allowedIds = new Set(
      grants.filter((g) => g.resourceType === 'document').map((g) => g.resourceId),
    );
    res.json(docs.filter((doc) => allowedIds.has(doc.id)));
  }));

  // Create document — requires auth, auto-grants owner role to creator
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = CreateDocumentBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const queryResult = CreateDocumentQuery.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: queryResult.error.issues });
      return;
    }

    const title = bodyResult.data.title || 'Untitled';
    const documentType: DocumentType = req.body?.documentType || 'text';
    if (!VALID_DOC_TYPES.includes(documentType)) {
      res.status(400).json({ error: `Invalid documentType. Must be one of: ${VALID_DOC_TYPES.join(', ')}` });
      return;
    }
    const id = randomUUID();

    const templateId = queryResult.data.templateId;
    let templateContent: Record<string, unknown> | null = null;
    if (templateId) {
      const template = await getTemplate(templateId);
      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      templateContent = template.content;
    }

    const doc = await createDocument(id, title, documentType);

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
    const bodyResult = UpdateDocumentBody.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const { title } = bodyResult.data;
    await updateDocumentTitle(String(req.params.id), title);
    res.json({ ok: true });
  }));

  // Delete document — removes document, cache, and permission grants
  router.delete('/:id', permissions.require('delete'), asyncHandler(async (req: Request, res: Response) => {
    const documentId = String(req.params.id);

    const deleted = await deleteDocument(documentId);
    if (!deleted) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (cache) {
      try {
        await cache.del(`doc:${documentId}`, `yjs:${documentId}`);
      } catch {
        // Cache cleanup is best-effort
      }
    }

    await permissions.grantStore.deleteByResource(documentId, 'document');

    res.json({
      deletedAt: new Date().toISOString(),
      documentId,
      scope: 'full',
    });
  }));

  return router;
}
