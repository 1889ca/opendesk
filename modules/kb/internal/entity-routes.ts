/** Contract: contracts/kb/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import type { KbEntityStore } from './pg-entities.ts';
import {
  EntityCreateInputSchema,
  EntityUpdateInputSchema,
  EntitySubtypeSchema,
  validateContentSafe,
} from '../index.ts';

const ListEntitiesQuery = z.object({
  subtype: EntitySubtypeSchema.optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type EntityRoutesOptions = {
  permissions: PermissionsModule;
  entityStore: KbEntityStore;
};

/**
 * Mount KB entity CRUD + search routes onto a router.
 */
export function createEntityRoutes(opts: EntityRoutesOptions): Router {
  const { permissions, entityStore } = opts;
  const router = Router();
  const workspaceId = '00000000-0000-0000-0000-000000000000';

  // List / search entities
  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const queryResult = ListEntitiesQuery.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: queryResult.error.issues,
        });
        return;
      }
      const { subtype, q, limit } = queryResult.data;
      const entities = await entityStore.listEntities(workspaceId, {
        subtype,
        query: q,
        limit,
      });
      res.json(entities);
    }),
  );

  // Search entities (lightweight, for mention picker)
  router.get(
    '/search',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const q = String(req.query.q ?? '');
      if (!q) {
        res.json([]);
        return;
      }
      const results = await entityStore.searchEntities(workspaceId, q, 10);
      res.json(
        results.map((e) => ({
          id: e.id,
          subtype: e.subtype,
          name: e.name,
        })),
      );
    }),
  );

  // Create entity
  router.post(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const bodyResult = EntityCreateInputSchema.safeParse(req.body ?? {});
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: bodyResult.error.issues,
        });
        return;
      }

      const { subtype, content } = bodyResult.data;
      const contentResult = validateContentSafe(subtype, content);
      if (!contentResult.ok) {
        res.status(400).json({
          error: 'Invalid content for subtype',
          detail: contentResult.error,
        });
        return;
      }

      const id = randomUUID();
      const principal = req.principal!;
      const entity = await entityStore.createEntity(id, workspaceId, principal.id, {
        ...bodyResult.data,
        content: contentResult.data,
      });
      res.status(201).json(entity);
    }),
  );

  // Get single entity
  router.get(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const entity = await entityStore.getEntity(String(req.params.id));
      if (!entity) {
        res.status(404).json({ error: 'Entity not found' });
        return;
      }
      res.json(entity);
    }),
  );

  // Update entity
  router.patch(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const bodyResult = EntityUpdateInputSchema.safeParse(req.body ?? {});
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: bodyResult.error.issues,
        });
        return;
      }

      if (bodyResult.data.subtype && bodyResult.data.content) {
        const contentResult = validateContentSafe(
          bodyResult.data.subtype,
          bodyResult.data.content,
        );
        if (!contentResult.ok) {
          res.status(400).json({
            error: 'Invalid content for subtype',
            detail: contentResult.error,
          });
          return;
        }
      }

      const updated = await entityStore.updateEntity(
        String(req.params.id),
        bodyResult.data,
      );
      if (!updated) {
        res.status(404).json({ error: 'Entity not found' });
        return;
      }
      res.json(updated);
    }),
  );

  // Delete entity
  router.delete(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const deleted = await entityStore.deleteEntity(String(req.params.id));
      if (!deleted) {
        res.status(404).json({ error: 'Entity not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
