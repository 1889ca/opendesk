/** Contract: contracts/audit/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createAuditRoutes } from './internal/audit-routes.ts';

/**
 * Audit module manifest.
 *
 * Replaces the hand-mount that used to live in
 * `modules/api/internal/create-routes.ts` for `/api/audit`. The
 * route factory pulls every dependency it needs straight from the
 * AppContext, so the composition root no longer has to know that
 * audit exists.
 */
export const manifest: OpenDeskManifest = {
  name: 'audit',
  contract: 'contracts/audit/rules.md',
  apiRoutes: [
    {
      mount: '/api/audit',
      factory: (ctx) =>
        createAuditRoutes({
          permissions: ctx.permissions,
          auditModule: ctx.audit,
          pool: ctx.pool,
          hmacSecret: ctx.config.audit.hmacSecret,
        }),
    },
  ],
};
