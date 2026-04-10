/** Contract: contracts/storage/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createTemplateRoutes } from './internal/template-routes.ts';
import { createColdStorageAdapter } from './internal/cold-storage.ts';
import { s3, getS3Bucket } from '../api/internal/s3-client.ts';

/** Key used to stash the cold adapter in the AppContext service registry. */
export const COLD_ADAPTER_KEY = 'storage.coldAdapter';

/**
 * Storage module manifest.
 *
 * Contributes:
 * - Template CRUD REST surface (`/api/templates`)
 * - Cold storage adapter lifecycle: created at startup and registered in the
 *   AppContext service registry under COLD_ADAPTER_KEY so that other manifests
 *   (e.g. document) can wire it into their DocumentRepository instances.
 */
export const manifest: OpenDeskManifest = {
  name: 'storage',
  contract: 'contracts/storage/rules.md',

  lifecycle: {
    onStart(ctx) {
      const adapter = createColdStorageAdapter(ctx.pool, s3, getS3Bucket());
      ctx.register(COLD_ADAPTER_KEY, adapter);
    },
  },

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
