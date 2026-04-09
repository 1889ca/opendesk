/** Contract: contracts/notifications/rules.md */
export {
  NotificationTypeSchema,
  NotificationSchema,
  CreateNotificationSchema,
} from './contract.ts';

export type {
  Notification,
  NotificationType,
  CreateNotification,
  NotificationStore,
  NotificationModule,
} from './contract.ts';

export { createPgNotificationStore } from './internal/pg-store.ts';
export { subscribeNotifications } from './internal/event-subscriber.ts';
