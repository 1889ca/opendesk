/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';
import {
  createSnapshot,
  getSnapshot,
  listSnapshots,
  getSnapshotEntries,
} from '../../kb/index.ts';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

const CreateSnapshotSchema = z.object({
  purpose: z.string().min(1).max(500),
});

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type KBSnapshotRoutesOptions = {
  permissions: PermissionsModule;
};

/** Mount KB snapshot routes for immutable entry-version captures. */
export function createKBSnapshotRoutes(opts: KBSnapshotRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  // Create a snapshot
  router.post(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const principal = req.principal!;
      const bodyResult = CreateSnapshotSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const snapshot = await createSnapshot(WORKSPACE_ID, bodyResult.data.purpose, principal.id);
      res.status(201).json(snapshot);
    }),
  );

  // List snapshots
  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const qr = ListQuerySchema.safeParse(req.query);
      if (!qr.success) {
        res.status(400).json({ error: 'Validation failed', issues: qr.error.issues });
        return;
      }
      const snapshots = await listSnapshots(WORKSPACE_ID, qr.data);
      res.json(snapshots);
    }),
  );

  // Get single snapshot
  router.get(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const snapshot = await getSnapshot(WORKSPACE_ID, String(req.params.id));
      if (!snapshot) {
        res.status(404).json({ error: 'Snapshot not found' });
        return;
      }
      res.json(snapshot);
    }),
  );

  // Resolve snapshot entries (versioned data)
  router.get(
    '/:id/entries',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const snapshot = await getSnapshot(WORKSPACE_ID, String(req.params.id));
      if (!snapshot) {
        res.status(404).json({ error: 'Snapshot not found' });
        return;
      }
      const entries = await getSnapshotEntries(WORKSPACE_ID, snapshot.id);
      res.json(entries);
    }),
  );

  return router;
}
