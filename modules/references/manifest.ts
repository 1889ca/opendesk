/** Contract: contracts/references/rules.md */

import type { OpenDeskManifest, AppContext } from '../core/manifest/contract.ts';
import { createReferenceRoutes } from './internal/reference-routes.ts';
import { createImportExportRoutes } from './internal/reference-import-routes.ts';
import { createReferencesStore } from './internal/pg-references.ts';

const REFS_HANDLE = 'references:stores';

interface ReferencesStores {
  referencesStore: ReturnType<typeof createReferencesStore>;
}

/**
 * References module manifest.
 *
 * Contributes the bibliography REST surface — both the CRUD/lookup
 * routes (DOI/ISBN resolution) and the import/export routes
 * (BibTeX, RIS) at the same `/api/references` mount path.
 *
 * All stores are constructed from ctx.pool via factory functions (DI).
 * No module reaches into storage/internal/pool.ts directly.
 */
export const manifest: OpenDeskManifest = {
  name: 'references',
  contract: 'contracts/references/rules.md',

  lifecycle: {
    onStart: (ctx: AppContext) => {
      const stores: ReferencesStores = {
        referencesStore: createReferencesStore(ctx.pool),
      };
      ctx.register(REFS_HANDLE, stores);
      return stores;
    },
  },

  apiRoutes: [
    {
      mount: '/api/references',
      order: 10,
      factory: (ctx) => {
        const stores = ctx.get<ReferencesStores>(REFS_HANDLE)!;
        return createReferenceRoutes({
          permissions: ctx.permissions,
          referencesStore: stores.referencesStore,
        });
      },
    },
    {
      mount: '/api/references',
      order: 20,
      factory: (ctx) => {
        const stores = ctx.get<ReferencesStores>(REFS_HANDLE)!;
        return createImportExportRoutes({
          permissions: ctx.permissions,
          referencesStore: stores.referencesStore,
        });
      },
    },
  ],
};
