/** Contract: contracts/observability/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createMetricsRoutes } from './internal/metrics-routes.ts';

/**
 * Observability module manifest.
 *
 * Contributes the `/api/admin/metrics` REST surface (metrics
 * summary, time series, SIEM forwarding controls).
 *
 * NOTE: The telemetry HTTP middleware
 * (`createTelemetryMiddleware`) is NOT registered here. It's a
 * pre-route middleware that wraps every `/api` request to record
 * latency / status / principal — manifests describe routes, not
 * middleware, so the composition root continues to install it
 * directly during setup. Likewise the `startHealthMonitor` call
 * stays in server.ts since it's a process-level concern, not a
 * per-request route.
 */
export const manifest: OpenDeskManifest = {
  name: 'observability',
  contract: 'contracts/observability/rules.md',
  apiRoutes: [
    {
      mount: '/api/admin/metrics',
      factory: (ctx) =>
        createMetricsRoutes({
          observability: ctx.observability,
          permissions: ctx.permissions,
          pool: ctx.pool,
        }),
    },
  ],
};
