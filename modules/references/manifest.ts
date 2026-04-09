/** Contract: contracts/references/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createReferenceRoutes } from './internal/reference-routes.ts';
import { createImportExportRoutes } from './internal/reference-import-routes.ts';

/**
 * References module manifest.
 *
 * Contributes the bibliography REST surface — both the CRUD/lookup
 * routes (DOI/ISBN resolution) and the import/export routes
 * (BibTeX, RIS) at the same `/api/references` mount path.
 */
export const manifest: OpenDeskManifest = {
  name: 'references',
  contract: 'contracts/references/rules.md',
  apiRoutes: [
    {
      mount: '/api/references',
      order: 10,
      factory: (ctx) => createReferenceRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/references',
      order: 20,
      factory: (ctx) => createImportExportRoutes({ permissions: ctx.permissions }),
    },
  ],
};
