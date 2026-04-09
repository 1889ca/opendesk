/** Contract: contracts/document/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  listDocuments as pgListDocuments,
  createDocument as defaultCreateDocument,
  getDocument as defaultGetDocument,
  deleteDocument as defaultDeleteDocument,
  updateDocumentTitle as defaultUpdateDocumentTitle,
  moveDocument as defaultMoveDocument,
  getTemplate as defaultGetTemplate,
  type ListDocumentsOptions,
} from '../../storage/index.ts';

function defaultListDocuments(params: ListDocumentsOptions) {
  return pgListDocuments(params);
}
import type { PermissionsModule } from '../../permissions/index.ts';
import type { CacheClient } from '../../api/internal/redis.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

const ListDocumentsQuery = z.object({
  folderId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['updated_at', 'created_at', 'title']).default('updated_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  type: z.enum(['text', 'spreadsheet', 'presentation']).optional(),
});

const CreateDocumentBody = z.object({
  title: z.string().min(1).max(200).optional(),
  documentType: z.enum(['text', 'spreadsheet', 'presentation']).optional().default('text'),
});

const CreateDocumentQuery = z.object({
  templateId: z.string().uuid().optional(),
});

const UpdateDocumentBody = z.object({
  title: z.string().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
});


type DocRecord = { id: string; [key: string]: unknown };

export type ListDocumentsParams = {
  folderId?: string | null;
  type?: string | null;
  sort?: 'updated_at' | 'created_at' | 'title';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type DocumentStorageFns = {
  listDocuments: (params: ListDocumentsParams) => Promise<{ rows: DocRecord[]; total: number }>;
  createDocument: (id: string, title: string, documentType: string) => Promise<DocRecord>;
  getDocument: (id: string) => Promise<DocRecord | null>;
  deleteDocument: (id: string) => Promise<boolean>;
  updateDocumentTitle: (id: string, title: string) => Promise<void>;
  moveDocument: (id: string, folderId: string | null) => Promise<boolean>;
  getTemplate: (id: string) => Promise<{ content: Record<string, unknown> } | null>;
};

export type DocumentRoutesOptions = {
  permissions: PermissionsModule;
  cache?: CacheClient;
  storage?: DocumentStorageFns;
};

/**
 * Mount document CRUD routes onto a router.
 * Each route enforces authentication and permission checks.
 */
export function createDocumentRoutes(opts: DocumentRoutesOptions): Router {
  const router = Router();
  const { permissions, cache, storage } = opts;
  const listDocuments = storage?.listDocuments ?? defaultListDocuments;
  const createDocument = storage?.createDocument ?? defaultCreateDocument;
  const getDocument = storage?.getDocument ?? defaultGetDocument;
  const deleteDocument = storage?.deleteDocument ?? defaultDeleteDocument;
  const updateDocumentTitle = storage?.updateDocumentTitle ?? defaultUpdateDocumentTitle;
  const moveDocument = storage?.moveDocument ?? defaultMoveDocument;
  const getTemplate = storage?.getTemplate ?? defaultGetTemplate;

  // List documents — supports ?folderId=, ?page=, ?limit=, ?sort=, ?sortDir=, ?type=
  // Always filters results by principal's grants (see issue #66)
  router.get('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const queryResult = ListDocumentsQuery.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: queryResult.error.issues });
      return;
    }
    const { folderId, page, limit, sort, sortDir, type } = queryResult.data;
    const offset = (page - 1) * limit;

    const principal = req.principal!;
    const grants = await permissions.grantStore.findByPrincipal(principal.id);
    const allowedIds = new Set(
      grants.filter((g) => g.resourceType === 'document').map((g) => g.resourceId),
    );

    // Fetch all matching docs (without pagination) to filter by grants, then paginate
    const allResult = await listDocuments({
      folderId: folderId ?? null,
      type: type ?? null,
      sort,
      sortDir,
      limit: 10000,
      offset: 0,
    });

    const filtered = allResult.rows.filter((doc) => allowedIds.has(doc.id));
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      data: paginated,
      pagination: { page, limit, total, totalPages },
    });
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
    const { documentType } = bodyResult.data;
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

  // Get current user's effective role on a document — requires read permission.
  // Called by the editor on load to enforce read-only mode for viewers/commenters.
  router.get('/:id/my-role', permissions.require('read'), asyncHandler(async (req: Request, res: Response) => {
    const documentId = String(req.params.id);
    const principal = req.principal!;
    const grants = await permissions.grantStore.findByPrincipalAndResource(
      principal.id,
      documentId,
      'document',
    );

    if (grants.length === 0) {
      // Permission middleware already verified read access; this is a safety net.
      res.status(403).json({ error: 'No grant found' });
      return;
    }

    // Pick the highest-ranked grant (matches the evaluate() logic).
    const ROLE_RANK: Record<string, number> = {
      owner: 4, editor: 3, commenter: 2, viewer: 1,
    };
    const best = grants.reduce((a, b) =>
      (ROLE_RANK[b.role] ?? 0) > (ROLE_RANK[a.role] ?? 0) ? b : a,
    );

    res.json({
      role: best.role,
      canWrite: ['owner', 'editor'].includes(best.role),
      canComment: ['owner', 'editor', 'commenter'].includes(best.role),
    });
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

  // Update document title and/or move to folder — requires write permission
  router.patch('/:id', permissions.require('write'), asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = UpdateDocumentBody.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const { title, folderId } = bodyResult.data;
    const id = String(req.params.id);
    if (title !== undefined) {
      await updateDocumentTitle(id, title);
    }
    if (folderId !== undefined) {
      await moveDocument(id, folderId);
    }
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
