/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';
import {
  createEntry,
  getEntry,
  listEntries,
  listPublishedEntries,
  updateEntry,
  deleteEntry,
  transitionStatus,
} from '../../kb/internal/pg-entries.ts';
import { validateTransition } from '../../kb/internal/lifecycle.ts';
import { KbEntryStatusSchema } from '../../kb/contract.ts';
import { CreateEntryInputSchema as KbEntryCreateInputSchema, UpdateEntryInputSchema as KbEntryUpdateInputSchema } from '../../kb/internal/schemas.ts';

const TransitionBody = z.object({
  to: KbEntryStatusSchema,
});

const ListQuery = z.object({
  status: KbEntryStatusSchema.optional(),
  publishedOnly: z.coerce.boolean().optional(),
});

export type KbRoutesOptions = {
  permissions: PermissionsModule;
};

/**
 * Mount KB entry CRUD + lifecycle routes onto a router.
 */
export function createKbRoutes(opts: KbRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  // List KB entries
  router.get('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const queryResult = ListQuery.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: queryResult.error.issues });
      return;
    }
    const workspaceId = '00000000-0000-0000-0000-000000000000';
    const { status, publishedOnly } = queryResult.data;

    if (publishedOnly) {
      const entries = await listPublishedEntries(workspaceId);
      res.json(entries);
      return;
    }

    const entries = await listEntries(workspaceId, status);
    res.json(entries);
  }));

  // Create KB entry
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = KbEntryCreateInputSchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const id = randomUUID();
    const principal = req.principal!;
    const workspaceId = '00000000-0000-0000-0000-000000000000';
    const entry = await createEntry(id, workspaceId, principal.id, bodyResult.data);
    res.status(201).json(entry);
  }));

  // Get single KB entry
  router.get('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const entry = await getEntry(String(req.params.id));
    if (!entry) {
      res.status(404).json({ error: 'KB entry not found' });
      return;
    }
    res.json(entry);
  }));

  // Update KB entry (creates new version)
  router.patch('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = KbEntryUpdateInputSchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const principal = req.principal!;
    const updated = await updateEntry(String(req.params.id), principal.id, bodyResult.data);
    if (!updated) {
      res.status(404).json({ error: 'KB entry not found' });
      return;
    }
    res.json(updated);
  }));

  // Transition status
  router.post('/:id/transition', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = TransitionBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }

    const entry = await getEntry(String(req.params.id));
    if (!entry) {
      res.status(404).json({ error: 'KB entry not found' });
      return;
    }

    const validation = validateTransition(entry.status, bodyResult.data.to);
    if (!validation.ok) {
      res.status(422).json({ error: validation.message, code: validation.code });
      return;
    }

    const updated = await transitionStatus(entry.id, bodyResult.data.to);
    res.json({ ok: true, entry: updated, previousStatus: entry.status });
  }));

  // Delete KB entry
  router.delete('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteEntry(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'KB entry not found' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
