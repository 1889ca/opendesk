/** Contract: contracts/convert/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createConvertRoutes } from './internal/convert-routes.ts';

/**
 * Convert module manifest.
 *
 * Contributes the document import/export REST surface (Collabora-
 * backed conversion to/from docx/odt/pdf). The router declares its
 * own absolute paths (`/api/documents/:id/convert-*`) so the
 * manifest mounts it at `/` rather than under a prefix.
 */
export const manifest: OpenDeskManifest = {
  name: 'convert',
  contract: 'contracts/convert/rules.md',
  apiRoutes: [
    {
      mount: '/',
      factory: (ctx) => createConvertRoutes({ permissions: ctx.permissions }),
    },
  ],
};
