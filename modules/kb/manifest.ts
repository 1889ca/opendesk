/** Contract: contracts/kb/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createKbRoutes } from './internal/kb-routes.ts';
import { createKbVersionRoutes } from './internal/kb-version-routes.ts';
import { createKBEntryRoutes } from './internal/kb-entry-routes.ts';
import { createKBDatasetRoutes } from './internal/kb-dataset-routes.ts';
import { createKBSnapshotRoutes } from './internal/kb-snapshot-routes.ts';
import { createEntityRoutes } from './internal/entity-routes.ts';

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
 * `kbRoutes` and `kbVersionRoutes` share the `/api/kb` mount path
 * and deliberately use different `order` values so the version
 * sub-routes (which use parameterized paths like `/:id/versions`)
 * are mounted last and don't shadow the more specific entry CRUD
 * paths registered by `kbRoutes`.
 */
export const manifest: OpenDeskManifest = {
  name: 'kb',
  contract: 'contracts/kb/rules.md',
  apiRoutes: [
    {
      mount: '/api/kb',
      order: 10,
      factory: (ctx) => createKbRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/kb/entries',
      order: 20,
      factory: (ctx) => createKBEntryRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/kb/entries/:entryId/rows',
      order: 30,
      factory: (ctx) => createKBDatasetRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/kb/snapshots',
      order: 40,
      factory: (ctx) => createKBSnapshotRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/kb/entities',
      order: 50,
      factory: (ctx) => createEntityRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/kb',
      order: 90,
      factory: (ctx) => createKbVersionRoutes({ permissions: ctx.permissions }),
    },
  ],
};
