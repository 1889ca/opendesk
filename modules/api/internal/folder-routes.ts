/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  createFolder,
  listFolders,
  renameFolder,
  deleteFolder,
  moveDocument,
  getFolder,
} from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';

const CreateFolderBody = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().nullish(),
});

const RenameFolderBody = z.object({
  name: z.string().min(1).max(200),
});

const MoveDocumentBody = z.object({
  folderId: z.string().uuid().nullable(),
});

const ListFoldersQuery = z.object({
  parentId: z.string().uuid().optional(),
});

export type FolderRoutesOptions = {
  permissions: PermissionsModule;
};

export function createFolderRoutes(opts: FolderRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  // List folders (root if no parentId) — always filtered by principal's grants (see issue #66)
  router.get('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const queryResult = ListFoldersQuery.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: queryResult.error.issues });
      return;
    }
    const folders = await listFolders(queryResult.data.parentId ?? null);

    const principal = req.principal!;
    const grants = await permissions.grantStore.findByPrincipal(principal.id);
    const allowedIds = new Set(
      grants.filter((g) => g.resourceType === 'folder').map((g) => g.resourceId),
    );
    res.json(folders.filter((f) => allowedIds.has(f.id)));
  }));

  // Create folder — auto-grants owner role to creator
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = CreateFolderBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const { name, parentId } = bodyResult.data;
    const id = randomUUID();
    const principal = req.principal!;
    const folder = await createFolder(id, name, parentId ?? null, principal.id);

    // Auto-grant owner role to folder creator
    await permissions.grantStore.create({
      principalId: principal.id,
      resourceId: id,
      resourceType: 'folder',
      role: 'owner',
      grantedBy: principal.id,
    });

    res.status(201).json(folder);
  }));

  // Rename folder — requires write permission via grants
  router.put('/:id', permissions.requireForResource('write', 'folder'), asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = RenameFolderBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const folder = await getFolder(String(req.params.id));
    if (!folder) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    await renameFolder(String(req.params.id), bodyResult.data.name);
    res.json({ ok: true });
  }));

  // Delete folder — requires delete permission via grants
  router.delete('/:id', permissions.requireForResource('delete', 'folder'), asyncHandler(async (req: Request, res: Response) => {
    const folder = await getFolder(String(req.params.id));
    if (!folder) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    await deleteFolder(String(req.params.id));
    res.json({ ok: true });
  }));

  return router;
}

/**
 * Move-document route, mounted under /api/documents.
 */
export function createMoveDocumentRoute(opts: FolderRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  router.put('/:id/move', permissions.require('write'), asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = MoveDocumentBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const moved = await moveDocument(String(req.params.id), bodyResult.data.folderId);
    if (!moved) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
