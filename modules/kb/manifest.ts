/** Contract: contracts/kb/rules.md */

import type { OpenDeskManifest, AppContext } from '../core/manifest/contract.ts';
import { createKbRoutes } from './internal/kb-routes.ts';
import { createKbVersionRoutes } from './internal/kb-version-routes.ts';
import { createKBEntryRoutes } from './internal/kb-entry-routes.ts';
import { createKBDatasetRoutes } from './internal/kb-dataset-routes.ts';
import { createKBSnapshotRoutes } from './internal/kb-snapshot-routes.ts';
import { createEntityRoutes } from './internal/entity-routes.ts';
import { createKbEntryStore } from './internal/pg-entries.ts';
import { createKbVersionStore } from './internal/pg-versions.ts';
import { createKbEntriesStore } from './internal/entries-store.ts';
import { createKbDatasetStore } from './internal/pg-datasets.ts';
import { createKbSnapshotStore } from './internal/pg-snapshots.ts';
import { createKbEntityStore } from './internal/pg-entities.ts';
import { createKbSearchStore } from './internal/search.ts';
import { createKbRelationshipStore } from './internal/relationships-store.ts';
import { createKbReverseDepsStore } from './internal/reverse-deps.ts';

const KB_HANDLE = 'kb:stores';

interface KbStores {
  entryStore: ReturnType<typeof createKbEntryStore>;
  versionStore: ReturnType<typeof createKbVersionStore>;
  entriesStore: ReturnType<typeof createKbEntriesStore>;
  datasetStore: ReturnType<typeof createKbDatasetStore>;
  snapshotStore: ReturnType<typeof createKbSnapshotStore>;
  entityStore: ReturnType<typeof createKbEntityStore>;
  searchStore: ReturnType<typeof createKbSearchStore>;
  relationshipStore: ReturnType<typeof createKbRelationshipStore>;
  reverseDepsStore: ReturnType<typeof createKbReverseDepsStore>;
}

function buildKbStores(ctx: AppContext): KbStores {
  return {
    entryStore: createKbEntryStore(ctx.pool),
    versionStore: createKbVersionStore(ctx.pool),
    entriesStore: createKbEntriesStore(ctx.pool),
    datasetStore: createKbDatasetStore(ctx.pool),
    snapshotStore: createKbSnapshotStore(ctx.pool),
    entityStore: createKbEntityStore(ctx.pool),
    searchStore: createKbSearchStore(ctx.pool),
    relationshipStore: createKbRelationshipStore(ctx.pool),
    reverseDepsStore: createKbReverseDepsStore(ctx.pool),
  };
}

/**
 * KB module manifest.
 *
 * Contributes the full Knowledge Base REST surface:
 *
 *   /api/kb                          — entry CRUD + lifecycle (kb.html browser)
 *   /api/kb (version sub-routes)     — version history + reference resolution
 *   /api/kb/entries                  — generalized entry CRUD + relationships
 *   /api/kb/entries/:entryId/rows    — dataset row operations
 *   /api/kb/snapshots                — immutable entry-version captures
 *   /api/kb/entities                 — entity directory (people, orgs, projects)
 *
 * All stores are constructed from ctx.pool via factory functions (DI).
 * No module reaches into storage/internal/pool.ts directly.
 */
export const manifest: OpenDeskManifest = {
  name: 'kb',
  contract: 'contracts/kb/rules.md',

  lifecycle: {
    onStart: (ctx: AppContext) => {
      const stores = buildKbStores(ctx);
      ctx.register(KB_HANDLE, stores);
      return stores;
    },
  },

  apiRoutes: [
    {
      mount: '/api/kb',
      order: 10,
      factory: (ctx) => {
        const stores = ctx.get<KbStores>(KB_HANDLE)!;
        return createKbRoutes({ permissions: ctx.permissions, entryStore: stores.entryStore });
      },
    },
    {
      mount: '/api/kb/entries',
      order: 20,
      factory: (ctx) => {
        const stores = ctx.get<KbStores>(KB_HANDLE)!;
        return createKBEntryRoutes({
          permissions: ctx.permissions,
          entriesStore: stores.entriesStore,
          searchStore: stores.searchStore,
          relationshipStore: stores.relationshipStore,
          reverseDepsStore: stores.reverseDepsStore,
        });
      },
    },
    {
      mount: '/api/kb/entries/:entryId/rows',
      order: 30,
      factory: (ctx) => {
        const stores = ctx.get<KbStores>(KB_HANDLE)!;
        return createKBDatasetRoutes({
          permissions: ctx.permissions,
          entriesStore: stores.entriesStore,
          datasetStore: stores.datasetStore,
        });
      },
    },
    {
      mount: '/api/kb/snapshots',
      order: 40,
      factory: (ctx) => {
        const stores = ctx.get<KbStores>(KB_HANDLE)!;
        return createKBSnapshotRoutes({ permissions: ctx.permissions, snapshotStore: stores.snapshotStore });
      },
    },
    {
      mount: '/api/kb/entities',
      order: 50,
      factory: (ctx) => {
        const stores = ctx.get<KbStores>(KB_HANDLE)!;
        return createEntityRoutes({ permissions: ctx.permissions, entityStore: stores.entityStore });
      },
    },
    {
      mount: '/api/kb',
      order: 90,
      factory: (ctx) => {
        const stores = ctx.get<KbStores>(KB_HANDLE)!;
        return createKbVersionRoutes({
          permissions: ctx.permissions,
          entryStore: stores.entryStore,
          versionStore: stores.versionStore,
        });
      },
    },
  ],
};
