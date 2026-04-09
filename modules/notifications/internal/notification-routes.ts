/** Contract: contracts/notifications/rules.md */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { NotificationStore } from '../contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type NotificationRoutesOptions = {
  permissions: PermissionsModule;
  notificationStore: NotificationStore;
};

export function createNotificationRoutes(
  opts: NotificationRoutesOptions,
): Router {
  const router = Router();
  const { permissions, notificationStore } = opts;

  // List notifications for the authenticated user
  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const q = ListQuery.safeParse(req.query);
      if (!q.success) {
        res.status(400).json({ error: 'Validation failed', issues: q.error.issues });
        return;
      }
      const userId = req.principal!.id;
      const [items, unreadCount] = await Promise.all([
        notificationStore.listByUser(userId, q.data.limit, q.data.offset),
        notificationStore.countUnread(userId),
      ]);
      res.json({ items, unreadCount });
    }),
  );

  // Mark a single notification as read
  router.patch(
    '/:id/read',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.principal!.id;
      const updated = await notificationStore.markRead(
        String(req.params.id),
        userId,
      );
      res.json({ ok: updated });
    }),
  );

  // Mark all notifications as read
  router.post(
    '/read-all',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.principal!.id;
      const count = await notificationStore.markAllRead(userId);
      res.json({ ok: true, updated: count });
    }),
  );

  // Dismiss (delete) a notification
  router.delete(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.principal!.id;
      const deleted = await notificationStore.dismiss(
        String(req.params.id),
        userId,
      );
      if (!deleted) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
