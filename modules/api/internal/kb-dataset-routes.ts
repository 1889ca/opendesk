/** Contract: contracts/api/rules.md */

/**
 * API routes for KB dataset CRUD and sheet linking.
 * Mounted at /api/kb/datasets.
 */

import { Router, type Request, type Response } from 'express';
import {
  CreateDatasetSchema,
  UpdateDatasetRowsSchema,
} from '../../kb/index.ts';
import type { DatasetStore } from '../../kb/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('api:kb-datasets');

export type KbDatasetRoutesOptions = {
  permissions: PermissionsModule;
  datasetStore: DatasetStore;
};

export function createKbDatasetRoutes(
  opts: KbDatasetRoutesOptions,
): Router {
  const router = Router();
  const { permissions, datasetStore } = opts;

  // List all datasets
  router.get(
    '/',
    asyncHandler(async (_req: Request, res: Response) => {
      const datasets = await datasetStore.list();
      res.json(datasets);
    }),
  );

  // Get a single dataset
  router.get(
    '/:datasetId',
    asyncHandler(async (req: Request, res: Response) => {
      const ds = await datasetStore.get(String(req.params.datasetId));
      if (!ds) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }
      res.json(ds);
    }),
  );

  // Create a dataset
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CreateDatasetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const ds = await datasetStore.create(parsed.data);
      res.status(201).json(ds);
    }),
  );

  // Update dataset rows
  router.put(
    '/:datasetId/rows',
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = UpdateDatasetRowsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const ds = await datasetStore.updateRows(
        String(req.params.datasetId),
        parsed.data.rows,
      );
      if (!ds) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }
      res.json(ds);
    }),
  );

  // Delete a dataset
  router.delete(
    '/:datasetId',
    asyncHandler(async (req: Request, res: Response) => {
      const deleted = await datasetStore.delete(String(req.params.datasetId));
      if (!deleted) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  // Link a sheet to a dataset
  router.post(
    '/:datasetId/link/:documentId',
    permissions.require('write'),
    asyncHandler(async (req: Request, res: Response) => {
      const ds = await datasetStore.get(String(req.params.datasetId));
      if (!ds) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }
      const link = await datasetStore.linkSheet(
        String(req.params.datasetId),
        String(req.params.documentId),
      );
      res.json(link);
    }),
  );

  // Unlink a sheet from its dataset
  router.delete(
    '/unlink/:documentId',
    permissions.require('write'),
    asyncHandler(async (req: Request, res: Response) => {
      const unlinked = await datasetStore.unlinkSheet(
        String(req.params.documentId),
      );
      if (!unlinked) {
        res.status(404).json({ error: 'No dataset linked' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  // Get linked dataset for a sheet
  router.get(
    '/linked/:documentId',
    asyncHandler(async (req: Request, res: Response) => {
      const ds = await datasetStore.getLinkedDataset(
        String(req.params.documentId),
      );
      if (!ds) {
        res.status(404).json({ error: 'No dataset linked' });
        return;
      }
      res.json(ds);
    }),
  );

  // Get sheet link info
  router.get(
    '/link-info/:documentId',
    asyncHandler(async (req: Request, res: Response) => {
      const link = await datasetStore.getSheetLink(
        String(req.params.documentId),
      );
      if (!link) {
        res.status(404).json({ error: 'No link found' });
        return;
      }
      res.json(link);
    }),
  );

  return router;
}
