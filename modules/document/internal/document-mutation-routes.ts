/** Contract: contracts/document/rules.md */
import { type Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { CacheClient } from '../../api/internal/redis.ts';
import type { DocumentStorageFns } from './document-routes.ts';

const UpdateDocumentBody = z.object({
  title: z.string().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

type MutationRoutesOptions = {
  router: Router;
  permissions: PermissionsModule;
  cache?: CacheClient;
  storage: DocumentStorageFns;
};

/**
 * Register per-document read, mutation, and delete routes onto the given router.
 * Covers GET /:id/my-role, GET /:id, PATCH /:id, and DELETE /:id.
 */
export function registerDocumentMutationRoutes(opts: MutationRoutesOptions): void {
  const { router, permissions, cache, storage } = opts;
  const { getDocument, deleteDocument, updateDocumentTitle, moveDocument } = storage;

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
}
