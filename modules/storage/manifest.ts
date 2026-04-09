/** Contract: contracts/api/templates.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createTemplateRoutes } from './internal/template-routes.ts';

/**
 * Storage module manifest.
 *
 * Currently contributes only the template CRUD REST surface
 * (`/api/templates`). The rest of storage's surface is consumed
 * directly by other modules (document, version, folder routes
 * etc.) and doesn't need its own routes.
 *
 * Templates live in storage because they're persisted PostgreSQL
 * rows alongside documents. The route file follows the same
 * convention as the document routes — its factory pulls
 * dependencies from the AppContext.
 */
export const manifest: OpenDeskManifest = {
  name: 'storage',
  contract: 'contracts/storage/rules.md',
  apiRoutes: [
    {
      mount: '/api/templates',
      factory: (ctx) =>
        createTemplateRoutes({
          permissions: ctx.permissions,
          authMode: ctx.config.auth.mode,
        }),
    },
  ],
};
