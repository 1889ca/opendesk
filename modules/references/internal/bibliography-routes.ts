/** Contract: contracts/references/rules.md */

import { Router, type Request, type Response } from 'express';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import type { ReferencesStore } from './pg-references.ts';
import type { CitationsStore } from './pg-citations.ts';

export type BibliographyRoutesOptions = {
  permissions: PermissionsModule;
  referencesStore: ReferencesStore;
  citationsStore: CitationsStore;
};

/**
 * Mount bibliography routes.
 *
 * Routes (mounted at /api/documents):
 *   GET /:docId/bibliography
 *     Returns all references cited in the document, sorted by first-author
 *     family name then issued date — ready to render as a bibliography list.
 *
 * No permission gate beyond auth is applied here: if the caller has a valid
 * session and knows the document ID, they can retrieve its bibliography.
 * Document-level access control is the responsibility of the documents module.
 */
export function createBibliographyRoutes(opts: BibliographyRoutesOptions): Router {
  const { permissions, referencesStore, citationsStore } = opts;
  const router = Router();

  router.get(
    '/:docId/bibliography',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const docId = String(req.params.docId);

      // Fetch citation links for this document
      const citations = await citationsStore.listCitationsForDocument(docId);
      if (citations.length === 0) {
        res.json([]);
        return;
      }

      // Fetch each referenced entry in parallel, skipping any that were deleted
      const refResults = await Promise.all(
        citations.map((c) => referencesStore.getReference(c.reference_id)),
      );
      const refs = refResults.filter((r) => r !== null);

      // Sort: first-author family name ASC, then issuedDate ASC
      refs.sort((a, b) => {
        const aName = (a!.authors as Array<{ family?: string }>)[0]?.family ?? '';
        const bName = (b!.authors as Array<{ family?: string }>)[0]?.family ?? '';
        const cmp = aName.localeCompare(bName);
        if (cmp !== 0) return cmp;
        return (a!.issued_date ?? '').localeCompare(b!.issued_date ?? '');
      });

      res.json(refs);
    }),
  );

  return router;
}
