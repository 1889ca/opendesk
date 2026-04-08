/** Contract: contracts/notifications/rules.md */
import { z } from 'zod';

export const NotificationTypeSchema = z.enum([
  'comment_added',
  'document_shared',
  'workflow_triggered',
  'kb_updated',
]);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().min(1),
  type: NotificationTypeSchema,
  payload: z.record(z.unknown()),
  read: z.boolean(),
  created_at: z.string(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export const CreateNotificationSchema = z.object({
  user_id: z.string().min(1),
  type: NotificationTypeSchema,
  payload: z.record(z.unknown()).default({}),
});

export type CreateNotification = z.infer<typeof CreateNotificationSchema>;

export interface NotificationStore {
  create(input: CreateNotification): Promise<Notification>;
  listByUser(userId: string, limit?: number, offset?: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  dismiss(id: string, userId: string): Promise<boolean>;
}

export interface NotificationModule {
  store: NotificationStore;
}
