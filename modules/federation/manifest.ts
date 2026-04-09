/** Contract: contracts/federation/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createFederation } from './internal/create-federation.ts';
import { createFederationRoutes } from './internal/federation-routes.ts';

/**
 * Federation module manifest.
 *
 * Contributes the `/api/federation` REST surface (peer management,
 * cross-instance document/KB exchange) only when
 * `config.federation.enabled` is true. Federation has no shutdown
 * hook so the module instance is constructed inline inside the
 * route factory; the factory runs exactly once per startup, so
 * this matches the previous gated hand-mount behavior in
 * create-routes.ts.
 */
export const manifest: OpenDeskManifest = {
  name: 'federation',
  contract: 'contracts/federation/rules.md',
  enabled: (config) => config.federation.enabled,
  apiRoutes: [
    {
      mount: '/api/federation',
      factory: (ctx) => {
        const federation = createFederation({
          pool: ctx.pool,
          config: ctx.config.federation,
          hmacSecret: ctx.config.audit.hmacSecret,
        });
        return createFederationRoutes({ federation, permissions: ctx.permissions });
      },
    },
  ],
};
