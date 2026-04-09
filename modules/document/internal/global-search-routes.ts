/** Contract: contracts/document/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { globalSearch as defaultGlobalSearch, type GlobalSearchResult } from '../../storage/index.ts';
import { loadConfig } from '../../config/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

const GlobalSearchQuery = z.object({
  q: z.string().min(2).max(200),
  type: z.enum(['document', 'spreadsheet', 'presentation']).optional(),
});

export type GlobalSearchFn = (
  query: string,
  allowedIds?: string[],
) => Promise<GlobalSearchResult[]>;

export type GlobalSearchRoutesOptions = {
  permissions: PermissionsModule;
  globalSearch?: GlobalSearchFn;
};

/**
 * Mount global search routes onto a router.
 * GET /api/search?q=term[&type=document|spreadsheet|presentation]
 * Returns results grouped by content type.
 */
export function createGlobalSearchRoutes(opts: GlobalSearchRoutesOptions): Router {
  const router = Router();
  const { permissions } = opts;
  const search = opts.globalSearch ?? defaultGlobalSearch;

  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = GlobalSearchQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: parsed.error.issues,
        });
        return;
      }

      const principal = req.principal!;
      let allowedIds: string[] | undefined;

      // In dev mode, skip permission filtering
      if (loadConfig().auth.mode !== 'dev') {
        const grants = await permissions.grantStore.findByPrincipal(principal.id);
        allowedIds = grants
          .filter((g) => g.resourceType === 'document')
          .map((g) => g.resourceId);
      }

      let results = await search(parsed.data.q, allowedIds);

      // Optional type filter
      if (parsed.data.type) {
        results = results.filter((r) => r.content_type === parsed.data.type);
      }

      // Group results by type for the frontend
      const grouped = {
        query: parsed.data.q,
        total: results.length,
        groups: groupByType(results),
      };

      res.json(grouped);
    }),
  );

  return router;
}

/** Group results by content_type, preserving rank order within each group. */
function groupByType(results: GlobalSearchResult[]) {
  const groups: Record<string, GlobalSearchResult[]> = {};
  for (const result of results) {
    const key = result.content_type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(result);
  }
  return groups;
}
