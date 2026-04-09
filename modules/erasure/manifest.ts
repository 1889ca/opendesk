/** Contract: contracts/erasure/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createErasure } from './internal/create-erasure.ts';
import { createErasureRoutes } from './internal/erasure-routes.ts';

/**
 * Erasure module manifest.
 *
 * Contributes the `/api/erasure` REST surface (GDPR-flavored
 * verifiable erasure, retention scans, attestation proofs).
 *
 * The erasure handle has no shutdown hook, so it is constructed
 * inline inside the route factory rather than via lifecycle.onStart
 * — the factory runs exactly once per startup, so this matches the
 * previous hand-mount behavior in create-routes.ts.
 */
export const manifest: OpenDeskManifest = {
  name: 'erasure',
  contract: 'contracts/erasure/rules.md',
  apiRoutes: [
    {
      mount: '/api/erasure',
      factory: (ctx) => {
        const erasure = createErasure({ pool: ctx.pool });
        return createErasureRoutes({ erasure, permissions: ctx.permissions });
      },
    },
  ],
};
