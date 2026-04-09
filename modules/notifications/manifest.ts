/** Contract: contracts/notifications/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createNotificationRoutes } from './internal/notification-routes.ts';
import { createPgNotificationStore } from './internal/pg-store.ts';

/**
 * Notifications module manifest.
 *
 * Contributes the `/api/notifications` REST surface (list, mark
 * read, mark all read, dismiss). The PG store is constructed lazily
 * inside the route factory so the composition root never has to
 * mention notifications by name.
 */
export const manifest: OpenDeskManifest = {
  name: 'notifications',
  contract: 'contracts/notifications/rules.md',
  apiRoutes: [
    {
      mount: '/api/notifications',
      factory: (ctx) =>
        createNotificationRoutes({
          permissions: ctx.permissions,
          notificationStore: createPgNotificationStore(ctx.pool),
        }),
    },
  ],
};
