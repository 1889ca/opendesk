/** Contract: contracts/document/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createSearchRoutes } from './internal/search-routes.ts';
import { createDocumentRoutes } from './internal/document-routes.ts';
import { createVersionRoutes } from './internal/version-routes.ts';
import { createFolderRoutes, createMoveDocumentRoute } from './internal/folder-routes.ts';
import { createExportRoutes } from './internal/export-routes.ts';
import { createPreviewRoutes } from './internal/preview-routes.ts';
import { createStarredRoutes } from './internal/starred-routes.ts';
import { createGlobalSearchRoutes } from './internal/global-search-routes.ts';

/**
 * Document module manifest.
 *
 * Contributes the document REST surface — list/CRUD, search,
 * versioning, folder management, and HTML/text export.
 *
 * Order is load-bearing: createSearchRoutes registers `/search` on
 * the `/api/documents` mount path, which must be matched before
 * createDocumentRoutes' `/:id` parameter route or every search
 * request would be interpreted as a document fetch with
 * `id="search"`. The explicit order field encodes that constraint
 * declaratively instead of relying on app.use call sequence.
 */
export const manifest: OpenDeskManifest = {
  name: 'document',
  contract: 'contracts/document/rules.md',
  apiRoutes: [
    {
      mount: '/api/documents',
      // Search must be mounted before /:id catches everything.
      order: 10,
      factory: (ctx) => createSearchRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/documents',
      order: 20,
      factory: (ctx) =>
        createDocumentRoutes({
          permissions: ctx.permissions,
          cache: ctx.redisClient,
        }),
    },
    {
      mount: '/api/documents/:id/versions',
      order: 30,
      factory: (ctx) =>
        createVersionRoutes({
          permissions: ctx.permissions,
          hocuspocus: ctx.hocuspocus,
        }),
    },
    {
      mount: '/api/documents',
      order: 40,
      factory: (ctx) => createMoveDocumentRoute({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/folders',
      order: 50,
      factory: (ctx) => createFolderRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/documents',
      order: 60,
      factory: (ctx) => createExportRoutes({ permissions: ctx.permissions }),
    },
    {
      // /:id/preview — safe to mount after /:id (order 20) because Express
      // only matches /:id to single-segment paths, not /abc/preview.
      mount: '/api/documents',
      order: 65,
      factory: (ctx) => createPreviewRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api/starred',
      order: 70,
      factory: (ctx) =>
        createStarredRoutes({
          permissions: ctx.permissions,
          pool: ctx.pool,
        }),
    },
    {
      // Cross-type global search (documents, spreadsheets, presentations).
      // The router declares its handler at '/' so the mount path IS the
      // public URL — frontend calls /api/search?q=...
      mount: '/api/search',
      order: 80,
      factory: (ctx) =>
        createGlobalSearchRoutes({ permissions: ctx.permissions }),
    },
  ],
};
