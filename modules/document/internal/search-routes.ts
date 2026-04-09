/** Contract: contracts/document/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { searchDocuments as defaultSearchDocuments, type SearchResult } from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

const SearchQuery = z.object({
  q: z.string().min(2).max(200),
});

export type SearchFn = (query: string, allowedIds?: string[]) => Promise<SearchResult[]>;

export type SearchRoutesOptions = {
  permissions: PermissionsModule;
  searchDocuments?: SearchFn;
};

/**
 * Mount search routes onto a router.
 * GET /api/documents/search?q=term — full-text search, filtered by user permissions.
 */
export function createSearchRoutes(opts: SearchRoutesOptions): Router {
  const router = Router();
  const { permissions } = opts;
  const searchDocuments = opts.searchDocuments ?? defaultSearchDocuments;

  router.get(
    '/search',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = SearchQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: parsed.error.issues,
        });
        return;
      }

      const principal = req.principal!;

      // Always enforce permission filtering — even in dev mode.
      // Skipping this was an IDOR vulnerability (see #66).
      const grants = await permissions.grantStore.findByPrincipal(principal.id);
      const allowedIds = grants
        .filter((g) => g.resourceType === 'document')
        .map((g) => g.resourceId);

      const results = await searchDocuments(parsed.data.q, allowedIds);
      res.json(results);
    }),
  );

  return router;
}
