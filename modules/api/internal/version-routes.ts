/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Hocuspocus } from '@hocuspocus/server';
import {
  saveVersion,
  listVersions,
  getVersion,
  deleteVersionRecord,
  getDocument,
  loadYjsState,
  saveYjsState,
} from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';

const CreateVersionBody = z.object({
  name: z.string().max(200).optional(),
});

export type VersionRoutesOptions = {
  permissions: PermissionsModule;
  hocuspocus: Hocuspocus;
};

/**
 * Mount version history routes under /api/documents/:id/versions.
 * Requires read permission to list/get, write to create/restore, delete to remove.
 */
export function createVersionRoutes(opts: VersionRoutesOptions): Router {
  const { permissions, hocuspocus } = opts;
  const router = Router({ mergeParams: true });

  // List versions — requires read permission on the document
  router.get('/', permissions.require('read'), asyncHandler(async (req: Request, res: Response) => {
    const docId = String(req.params.id);
    const versions = await listVersions(docId);
    res.json(versions);
  }));

  // Create a named version — requires write permission
  router.post('/', permissions.require('write'), asyncHandler(async (req: Request, res: Response) => {
    const docId = String(req.params.id);
    const bodyResult = CreateVersionBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }

    const doc = await getDocument(docId);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Get the current Yjs state and convert to a JSON snapshot
    const yjsState = await loadYjsState(docId);
    const content = yjsState
      ? { yjsBase64: Buffer.from(yjsState).toString('base64') }
      : {};

    const title = bodyResult.data.name || `Version`;
    const principal = req.principal!;
    const versionId = randomUUID();

    const version = await saveVersion(versionId, docId, content, title, principal.id);
    res.status(201).json(version);
  }));

  // Get a specific version — requires read permission
  router.get('/:versionId', permissions.require('read'), asyncHandler(async (req: Request, res: Response) => {
    const version = await getVersion(String(req.params.versionId));
    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    if (version.document_id !== String(req.params.id)) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    res.json(version);
  }));

  // Restore a version — requires write permission
  router.post('/:versionId/restore', permissions.require('write'), asyncHandler(async (req: Request, res: Response) => {
    const version = await getVersion(String(req.params.versionId));
    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    if (version.document_id !== String(req.params.id)) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    const content = version.content as { yjsBase64?: string };
    if (content.yjsBase64) {
      const state = new Uint8Array(Buffer.from(content.yjsBase64, 'base64'));
      await saveYjsState(version.document_id, state);
    }

    // Force-disconnect all active WebSocket sessions for this document.
    // Clients will reconnect and load the restored state from the DB.
    const documentId = String(req.params.id);
    hocuspocus.closeConnections(documentId);

    res.json({ ok: true, restoredVersion: version.version_number });
  }));

  // Delete a version — requires delete permission
  router.delete('/:versionId', permissions.require('delete'), asyncHandler(async (req: Request, res: Response) => {
    const version = await getVersion(String(req.params.versionId));
    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    if (version.document_id !== String(req.params.id)) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    await deleteVersionRecord(String(req.params.versionId));
    res.json({ ok: true });
  }));

  return router;
}
