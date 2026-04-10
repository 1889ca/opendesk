/** Contract: contracts/kb/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import type { KbEntriesStore } from './entries-store.ts';
import type { KbDatasetStore } from './pg-datasets.ts';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

const RowDataSchema = z.record(z.unknown());

const InsertRowsSchema = z.object({
  rows: z.array(z.object({ data: RowDataSchema })).min(1).max(500),
  startIndex: z.number().int().nonnegative().optional(),
});

const ReplaceRowsSchema = z.object({
  rows: z.array(z.object({ data: RowDataSchema })).max(5000),
});

const UpdateRowSchema = z.object({
  data: RowDataSchema,
});

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type KBDatasetRoutesOptions = {
  permissions: PermissionsModule;
  entriesStore: KbEntriesStore;
  datasetStore: KbDatasetStore;
};

/** Mount dataset row CRUD routes under /api/kb/entries/:entryId/rows. */
export function createKBDatasetRoutes(opts: KBDatasetRoutesOptions): Router {
  const { permissions, entriesStore, datasetStore } = opts;
  const router = Router({ mergeParams: true });

  /** Verify the entry exists and is a dataset type. */
  async function requireDatasetEntry(entryId: string, res: Response): Promise<boolean> {
    const entry = await entriesStore.getEntry(WORKSPACE_ID, entryId);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return false;
    }
    if (entry.entryType !== 'dataset') {
      res.status(400).json({ error: 'Entry is not a dataset' });
      return false;
    }
    return true;
  }

  // List rows
  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const entryId = String(req.params.entryId);
      if (!(await requireDatasetEntry(entryId, res))) return;
      const qr = PaginationSchema.safeParse(req.query);
      if (!qr.success) {
        res.status(400).json({ error: 'Validation failed', issues: qr.error.issues });
        return;
      }
      const rows = await datasetStore.getRows(entryId, qr.data);
      const total = await datasetStore.getRowCount(entryId);
      res.json({ rows, total });
    }),
  );

  // Insert rows
  router.post(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const entryId = String(req.params.entryId);
      if (!(await requireDatasetEntry(entryId, res))) return;
      const bodyResult = InsertRowsSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const inserted = await datasetStore.insertRows(entryId, bodyResult.data.rows, bodyResult.data.startIndex);
      res.status(201).json(inserted);
    }),
  );

  // Replace all rows (atomic)
  router.put(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const entryId = String(req.params.entryId);
      if (!(await requireDatasetEntry(entryId, res))) return;
      const bodyResult = ReplaceRowsSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const rows = await datasetStore.replaceRows(entryId, bodyResult.data.rows);
      res.json({ rows, total: rows.length });
    }),
  );

  // Update single row
  router.patch(
    '/:rowId',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const entryId = String(req.params.entryId);
      const rowId = String(req.params.rowId);
      if (!(await requireDatasetEntry(entryId, res))) return;
      const bodyResult = UpdateRowSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const updated = await datasetStore.updateRow(rowId, entryId, bodyResult.data.data);
      if (!updated) {
        res.status(404).json({ error: 'Row not found' });
        return;
      }
      res.json(updated);
    }),
  );

  // Delete single row
  router.delete(
    '/:rowId',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const entryId = String(req.params.entryId);
      const rowId = String(req.params.rowId);
      if (!(await requireDatasetEntry(entryId, res))) return;
      const deleted = await datasetStore.deleteRow(rowId, entryId);
      if (!deleted) {
        res.status(404).json({ error: 'Row not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
