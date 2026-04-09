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
import { registerDocumentMutationRoutes } from './document-mutation-routes.ts';

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
  const storageFns: DocumentStorageFns = {
    listDocuments: storage?.listDocuments ?? defaultListDocuments,
    createDocument: storage?.createDocument ?? defaultCreateDocument,
    getDocument: storage?.getDocument ?? defaultGetDocument,
    deleteDocument: storage?.deleteDocument ?? defaultDeleteDocument,
    updateDocumentTitle: storage?.updateDocumentTitle ?? defaultUpdateDocumentTitle,
    moveDocument: storage?.moveDocument ?? defaultMoveDocument,
    getTemplate: storage?.getTemplate ?? defaultGetTemplate,
  };
  const { listDocuments, createDocument, getTemplate } = storageFns;

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

  registerDocumentMutationRoutes({ router, permissions, cache, storage: storageFns });

  return router;
}
