/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { searchDocuments } from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';

const SearchQuery = z.object({
  q: z.string().min(2).max(200),
});

export type SearchRoutesOptions = {
  permissions: PermissionsModule;
};

/**
 * Mount search routes onto a router.
 * GET /api/documents/search?q=term — full-text search across all documents.
 */
export function createSearchRoutes(opts: SearchRoutesOptions): Router {
  const router = Router();
  const { permissions } = opts;

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

      const results = await searchDocuments(parsed.data.q);
      res.json(results);
    }),
  );

  return router;
}
