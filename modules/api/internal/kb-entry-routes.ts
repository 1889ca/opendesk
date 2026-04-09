/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';
import {
  createEntry,
  getEntry,
  updateEntry,
  deleteEntry,
  listEntries,
  searchEntries,
  getRelationships,
  getReverseDependencies,
  createRelationship,
  deleteRelationship,
  EntryTypeSchema,
  CreateEntryInputSchema,
  UpdateEntryInputSchema,
  CreateRelationshipInputSchema,
} from '../../kb/index.ts';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

const CorpusSchema = z.enum(['knowledge', 'operational', 'reference']);

const ListQuerySchema = z.object({
  entryType: EntryTypeSchema.optional(),
  tags: z.string().optional(),
  search: z.string().max(200).optional(),
  corpus: CorpusSchema.optional(),
  jurisdiction: z.string().max(20).optional(),
  sort: z.enum(['date-desc', 'date-asc', 'title-asc', 'title-desc']).default('date-desc'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type KBEntryRoutesOptions = {
  permissions: PermissionsModule;
};

/** Mount KB entry CRUD, search, and relationship routes. */
export function createKBEntryRoutes(opts: KBEntryRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  // List entries with optional filters
  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const qr = ListQuerySchema.safeParse(req.query);
      if (!qr.success) {
        res.status(400).json({ error: 'Validation failed', issues: qr.error.issues });
        return;
      }
      const { entryType, tags, search, corpus, jurisdiction, limit, offset } = qr.data;
      if (search) {
        const results = await searchEntries(WORKSPACE_ID, search, { entryType, corpus, jurisdiction, limit, offset });
        res.json(results.map((r) => ({ ...r.entry, snippet: r.snippet, rank: r.rank })));
        return;
      }
      const parsedTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
      const entries = await listEntries(WORKSPACE_ID, { entryType, tags: parsedTags, corpus, jurisdiction, limit, offset });
      res.json(entries);
    }),
  );

  // Create entry
  router.post(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const principal = req.principal!;
      const input = {
        ...req.body,
        workspaceId: WORKSPACE_ID,
        createdBy: principal.id,
      };
      const bodyResult = CreateEntryInputSchema.safeParse(input);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const entry = await createEntry(bodyResult.data);
      res.status(201).json(entry);
    }),
  );

  // Get single entry
  router.get(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const entry = await getEntry(WORKSPACE_ID, String(req.params.id));
      if (!entry) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
      res.json(entry);
    }),
  );

  // Update entry
  router.patch(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const principal = req.principal!;
      const input = { ...req.body, updatedBy: principal.id };
      const bodyResult = UpdateEntryInputSchema.safeParse(input);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const updated = await updateEntry(WORKSPACE_ID, String(req.params.id), bodyResult.data);
      if (!updated) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
      res.json(updated);
    }),
  );

  // Delete entry
  router.delete(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const deleted = await deleteEntry(WORKSPACE_ID, String(req.params.id));
      if (!deleted) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  // Get relationships for an entry
  router.get(
    '/:id/relationships',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const entryId = String(req.params.id);
      const direction = (req.query.direction as string) || 'both';
      const dir = direction === 'outgoing' || direction === 'incoming' ? direction : 'both';
      const rels = await getRelationships(WORKSPACE_ID, entryId, dir);
      res.json(rels);
    }),
  );

  // Get reverse dependencies for an entry
  router.get(
    '/:id/reverse-deps',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const entryId = String(req.params.id);
      const relationType = req.query.relationType as string | undefined;
      const deps = await getReverseDependencies(WORKSPACE_ID, entryId, relationType);
      res.json(deps);
    }),
  );

  // Create relationship
  router.post(
    '/relationships',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const input = { ...req.body, workspaceId: WORKSPACE_ID };
      const bodyResult = CreateRelationshipInputSchema.safeParse(input);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const rel = await createRelationship(bodyResult.data);
      res.status(201).json(rel);
    }),
  );

  // Delete relationship
  router.delete(
    '/relationships/:relId',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const deleted = await deleteRelationship(WORKSPACE_ID, String(req.params.relId));
      if (!deleted) {
        res.status(404).json({ error: 'Relationship not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
