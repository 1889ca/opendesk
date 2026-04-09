/** Contract: contracts/workflow/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createWorkflowRoutes } from './internal/workflow-routes.ts';
import { createPluginRoutes } from './internal/plugin-routes.ts';

/**
 * Workflow module manifest.
 *
 * Contributes:
 *   - `/api/workflows` (CRUD + execution history)
 *   - `/api/workflows/plugins` (Wasm plugin registry)
 *   - The workflow editor frontend bundle (JS + CSS)
 *
 * Replaces the hand-mounts that used to live in
 * `modules/api/internal/create-routes.ts` and the matching bundle
 * entries in `scripts/frontend-bundles.mjs`.
 */
export const manifest: OpenDeskManifest = {
  name: 'workflow',
  contract: 'contracts/workflow/rules.md',
  apiRoutes: [
    {
      mount: '/api/workflows',
      // Mount before /api/workflows/plugins (order 20) so that the
      // catch-all `/api/workflows` router is registered first.
      // Express still matches the more specific path correctly, but
      // making the order explicit insures against future routes.
      order: 10,
      factory: (ctx) =>
        createWorkflowRoutes({
          permissions: ctx.permissions,
          workflowModule: ctx.workflow,
        }),
    },
    {
      mount: '/api/workflows/plugins',
      order: 20,
      factory: (ctx) =>
        createPluginRoutes({
          permissions: ctx.permissions,
          pool: ctx.pool,
        }),
    },
  ],
  frontend: {
    bundles: [
      {
        kind: 'js',
        entryPoint: 'modules/app/internal/workflows/workflow-page.ts',
        outfile: 'workflows.bundle.js',
      },
      {
        kind: 'css',
        entryPoint: 'modules/app/internal/css/workflows.css',
        outfile: 'workflows.bundle.css',
      },
    ],
  },
};
