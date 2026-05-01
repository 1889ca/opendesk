/** Contract: contracts/forms/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createFormRoutes } from './internal/form-routes.ts';
import { createFormPageRoutes } from './internal/form-page-routes.ts';

/**
 * Forms module manifest.
 *
 * API routes (under /api/forms):
 *   POST   /api/forms                    — create a form (auth required)
 *   GET    /api/forms/:id                — get form definition (public)
 *   PUT    /api/forms/:id                — update form schema (auth required)
 *   DELETE /api/forms/:id                — delete form (auth required)
 *   POST   /api/forms/:id/responses      — submit a response (public or auth)
 *   GET    /api/forms/:id/responses      — list responses (auth, owner)
 *
 * Page routes (HTML delivery):
 *   GET /f/:formId              — public respondent page
 *   GET /form-builder/:formId   — authenticated builder page
 *   GET /form-builder           — new form builder
 */
export const manifest: OpenDeskManifest = {
  name: 'forms',
  contract: 'contracts/forms/rules.md',
  apiRoutes: [
    {
      mount: '/api/forms',
      order: 10,
      factory: (ctx) => createFormRoutes({
        permissions: ctx.permissions,
        audit: ctx.audit,
        eventBus: ctx.eventBus,
      }),
    },
    {
      // Page routes: /f/:formId, /form-builder/:formId, /form-builder
      // Mounted at '/' so they match from the root. These must mount
      // before the SPA catch-all in server.ts (order: 5 < default 100).
      mount: '/',
      order: 5,
      factory: (ctx) => createFormPageRoutes(ctx.publicDir),
    },
  ],
  frontend: {
    bundles: [
      {
        kind: 'js',
        entryPoint: 'modules/forms/internal/form-builder.ts',
        outfile: 'form-builder.bundle.js',
      },
      {
        kind: 'css',
        entryPoint: 'modules/forms/internal/css/form-builder.css',
        outfile: 'form-builder.css',
      },
      {
        kind: 'js',
        entryPoint: 'modules/forms/internal/form-respondent.ts',
        outfile: 'form-respondent.bundle.js',
      },
      {
        kind: 'css',
        entryPoint: 'modules/forms/internal/css/form-respondent.css',
        outfile: 'form-respondent.css',
      },
    ],
  },
};
