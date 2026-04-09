/** Contract: contracts/convert/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createConvertRoutes } from './internal/convert-routes.ts';
import { createPresentationConvertRoutes } from './internal/presentation-convert-routes.ts';
import { createSheetConvertRoutes } from './internal/sheet-convert-routes.ts';

/**
 * Convert module manifest.
 *
 * Contributes Collabora-backed conversion REST surfaces for all
 * three document kinds. Each router declares its handlers with
 * absolute paths (e.g. `/api/documents/:id/convert-import`,
 * `/api/sheets/:id/import`, `/api/presentations/:id/convert-import`)
 * so the manifest mounts them at `/`.
 *
 * The presentation and sheet routers were shipped in earlier
 * commits but never wired into the composition root — frontend
 * code in modules/app/internal/{slides,sheets} fetches their
 * endpoints and was silently 404ing. Wiring them via the manifest
 * fixes the omission.
 */
export const manifest: OpenDeskManifest = {
  name: 'convert',
  contract: 'contracts/convert/rules.md',
  apiRoutes: [
    {
      mount: '/',
      order: 10,
      factory: (ctx) => createConvertRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/',
      order: 20,
      factory: (ctx) =>
        createPresentationConvertRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/',
      order: 30,
      factory: (ctx) =>
        createSheetConvertRoutes({ permissions: ctx.permissions }),
    },
  ],
};
