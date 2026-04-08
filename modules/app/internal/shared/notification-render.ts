/** Contract: contracts/app/rules.md */
import { apiFetch } from './api-client.ts';
import { t } from '../i18n/index.ts';
import { formatRelativeTime } from './time-format.ts';

export interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface NotificationResponse {
  items: NotificationItem[];
  unreadCount: number;
}

const NOTIFICATION_LABELS: Record<string, string> = {
  comment_added: 'notifications.commentAdded',
  document_shared: 'notifications.documentShared',
  workflow_triggered: 'notifications.workflowTriggered',
  kb_updated: 'notifications.kbUpdated',
};

function getNotificationText(item: NotificationItem): string {
  const key = NOTIFICATION_LABELS[item.type] || item.type;
  const title = (item.payload?.title as string) || '';
  return t(key as never, { title });
}

export function updateBadge(badge: HTMLElement, count: number): void {
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

export async function refreshBadge(badge: HTMLElement): Promise<void> {
  try {
    const res = await apiFetch('/api/notifications?limit=1');
    if (!res.ok) return;
    const data: NotificationResponse = await res.json();
    updateBadge(badge, data.unreadCount);
  } catch { /* silent */ }
}

/** Render a single notification item row. */
export function renderNotifItem(
  item: NotificationItem,
  badge: HTMLElement,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'notif-item' + (item.read ? '' : ' unread');

  const text = document.createElement('div');
  text.className = 'notif-item-text';
  text.textContent = getNotificationText(item);

  const time = document.createElement('div');
  time.className = 'notif-item-time';
  time.textContent = formatRelativeTime(item.created_at);

  const actions = document.createElement('div');
  actions.className = 'notif-item-actions';

  if (!item.read) {
    const readBtn = document.createElement('button');
    readBtn.className = 'notif-action-btn';
    readBtn.textContent = t('notifications.markRead');
    readBtn.addEventListener('click', async () => {
      await apiFetch(`/api/notifications/${item.id}/read`, { method: 'PATCH' });
      row.classList.remove('unread');
      readBtn.remove();
      refreshBadge(badge);
    });
    actions.appendChild(readBtn);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'notif-action-btn notif-action-dismiss';
  dismissBtn.textContent = t('notifications.dismiss');
  dismissBtn.addEventListener('click', async () => {
    await apiFetch(`/api/notifications/${item.id}`, { method: 'DELETE' });
    row.remove();
    refreshBadge(badge);
  });
  actions.appendChild(dismissBtn);

  row.appendChild(text);
  row.appendChild(time);
  row.appendChild(actions);
  return row;
}
