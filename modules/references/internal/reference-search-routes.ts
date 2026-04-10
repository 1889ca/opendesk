/** Contract: contracts/references/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import type { ReferencesStore } from './pg-references.ts';
import { ensureLibraryGrant, checkLibraryAccess } from '../index.ts';

const SearchQuery = z.object({
  q: z.string().min(1).max(500),
});

const BulkDeleteBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

export type SearchRoutesOptions = {
  permissions: PermissionsModule;
  referencesStore: ReferencesStore;
};

/**
 * Mount reference search and bulk-delete routes onto a router.
 *
 * Routes:
 *   GET  /search?q=...          Full-text search across references.
 *   DELETE /                    Bulk delete references by ID array.
 */
export function createSearchRoutes(opts: SearchRoutesOptions): Router {
  const { permissions, referencesStore } = opts;
  const router = Router();

  async function gateLibrary(
    req: Request,
    res: Response,
    action: 'read' | 'write' | 'delete',
    ensureGrant = false,
  ): Promise<boolean> {
    const principal = req.principal!;
    if (ensureGrant) {
      await ensureLibraryGrant(permissions.grantStore, principal.id, DEFAULT_WORKSPACE_ID);
    }
    const allowed = await checkLibraryAccess(
      permissions.grantStore,
      principal.id,
      DEFAULT_WORKSPACE_ID,
      action,
    );
    if (!allowed) {
      res.status(403).json({ error: `No ${action} access to reference library` });
      return false;
    }
    return true;
  }

  // Full-text search: GET /search?q=<query>
  router.get('/search', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const qResult = SearchQuery.safeParse(req.query);
    if (!qResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: qResult.error.issues });
      return;
    }
    if (!await gateLibrary(req, res, 'read', /* ensureGrant */ true)) return;

    const rows = await referencesStore.searchReferences(DEFAULT_WORKSPACE_ID, qResult.data.q);
    res.json(rows);
  }));

  // Bulk delete: DELETE / with body { ids: string[] }
  router.delete('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = BulkDeleteBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    if (!await gateLibrary(req, res, 'delete')) return;

    const count = await referencesStore.deleteReferences(bodyResult.data.ids);
    res.json({ deleted: count });
  }));

  return router;
}
