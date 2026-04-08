/** Contract: contracts/app/rules.md */
import { apiFetch } from './api-client.ts';
import { t } from '../i18n/index.ts';
import {
  type NotificationResponse,
  updateBadge,
  refreshBadge,
  renderNotifItem,
} from './notification-render.ts';

let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Build and insert the notification bell into the toolbar. */
export function buildNotificationBell(): void {
  const toolbarRight = document.querySelector('.toolbar-right');
  if (!toolbarRight) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'notif-bell-wrapper';

  const btn = document.createElement('button');
  btn.className = 'notif-bell-btn';
  btn.setAttribute('aria-label', t('notifications.title'));
  btn.innerHTML = '<span class="notif-bell-icon">\u{1F514}</span>';

  const badge = document.createElement('span');
  badge.className = 'notif-badge';
  badge.hidden = true;
  btn.appendChild(badge);

  const dropdown = document.createElement('div');
  dropdown.className = 'notif-dropdown';

  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('notif-dropdown-open');
    if (dropdown.classList.contains('notif-dropdown-open')) {
      loadNotifications(dropdown, badge);
    }
  });

  document.addEventListener('click', () => dropdown.classList.remove('notif-dropdown-open'));
  dropdown.addEventListener('click', (e) => e.stopPropagation());

  // Insert before the theme toggle
  const themeWrapper = toolbarRight.querySelector('.settings-dropdown-wrapper');
  if (themeWrapper) {
    const sep = document.createElement('span');
    sep.className = 'toolbar-separator';
    toolbarRight.insertBefore(sep, themeWrapper);
    toolbarRight.insertBefore(wrapper, sep);
  } else {
    toolbarRight.appendChild(wrapper);
  }

  refreshBadge(badge);
  pollTimer = setInterval(() => refreshBadge(badge), 30_000);
}

async function loadNotifications(dropdown: HTMLElement, badge: HTMLElement): Promise<void> {
  dropdown.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'notif-header';
  const title = document.createElement('span');
  title.className = 'notif-title';
  title.textContent = t('notifications.title');
  const markAllBtn = document.createElement('button');
  markAllBtn.className = 'notif-mark-all';
  markAllBtn.textContent = t('notifications.markAllRead');
  markAllBtn.addEventListener('click', async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    updateBadge(badge, 0);
    loadNotifications(dropdown, badge);
  });
  header.appendChild(title);
  header.appendChild(markAllBtn);
  dropdown.appendChild(header);

  try {
    const res = await apiFetch('/api/notifications?limit=20');
    if (!res.ok) return;
    const data: NotificationResponse = await res.json();
    updateBadge(badge, data.unreadCount);

    if (!data.items.length) {
      const empty = document.createElement('div');
      empty.className = 'notif-empty';
      empty.textContent = t('notifications.empty');
      dropdown.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'notif-list';
    for (const item of data.items) {
      list.appendChild(renderNotifItem(item, badge));
    }
    dropdown.appendChild(list);
  } catch { /* silent */ }
}

/** Cleanup polling interval. */
export function destroyNotificationBell(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}
