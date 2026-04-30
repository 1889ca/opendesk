/** Contract: contracts/api/rules.md */

import type { OpenDeskManifest, AppContext } from '../core/manifest/contract.ts';
import { createAdminRoutes } from './internal/admin-routes.ts';
import { createUploadRoutes } from './internal/upload-routes.ts';
import { createFileRoutes } from './internal/file-routes.ts';
import { createSSERoutes } from './internal/sse-routes.ts';
import { createSseFanout, type SseFanout } from './internal/sse-fanout.ts';
import { EventType, type DomainEvent } from '../events/index.ts';

const SSE_FANOUT_HANDLE = 'api:sse-fanout';

// Event types the SSE consumer group subscribes to
const SSE_EVENT_TYPES = [
  EventType.DocumentUpdated,
  EventType.StateFlushed,
  EventType.GrantCreated,
  EventType.GrantRevoked,
] as const;

/**
 * API module manifest.
 *
 * Owns the api-layer routes that have no natural home in a domain
 * module — admin (user data purge per `contracts/api/admin.md`),
 * upload (S3 image ingestion per `contracts/api/uploads.md`), file
 * serving, and the SSE event stream (GET /api/events/stream).
 *
 * The SSE route requires a lifecycle hook: `onStart` creates the
 * in-process fanout hub, registers one EventBus consumer group for
 * all SSE-relevant event types, and fans received events out to all
 * active SSE connections. `onShutdown` is a no-op because the
 * EventBus stops consuming on its own during graceful shutdown.
 *
 * Mounts:
 *   /api/admin    — admin/admin.md (user data purge)
 *   /api          — uploads/uploads.md (POST /api/upload, GET /api/files/*)
 *   /api          — SSE stream (GET /api/events/stream)
 */
export const manifest: OpenDeskManifest = {
  name: 'api',
  contract: 'contracts/api/rules.md',

  lifecycle: {
    onStart: async (ctx: AppContext) => {
      const fanout = createSseFanout();

      await ctx.eventBus.subscribe(
        'sse-stream',
        SSE_EVENT_TYPES as unknown as (typeof SSE_EVENT_TYPES)[number][],
        async (event: DomainEvent) => {
          fanout.emit(event);
        },
      );

      ctx.register(SSE_FANOUT_HANDLE, fanout);
      return fanout;
    },
  },

  apiRoutes: [
    {
      mount: '/api/admin',
      order: 10,
      factory: (ctx) =>
        createAdminRoutes({
          permissions: ctx.permissions,
          cache: ctx.redisClient,
        }),
    },
    {
      mount: '/api',
      order: 20,
      factory: (ctx) => createUploadRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api',
      order: 30,
      factory: (ctx) => createFileRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api',
      order: 40,
      factory: (ctx) => {
        const fanout = ctx.get<SseFanout>(SSE_FANOUT_HANDLE);
        if (!fanout) {
          throw new Error(
            'api manifest: SSE route factory ran before onStart registered the fanout handle ' +
              '— composition root must call runManifestStartHooks before mountManifestRoutes',
          );
        }
        return createSSERoutes(fanout, ctx.permissions.grantStore);
      },
    },
  ],
};
