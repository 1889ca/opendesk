/** Contract: contracts/app/offline.md */

/**
 * Offline status indicator component.
 * Shows connection state in the toolbar: Offline / Syncing / Synced.
 * Also shows an "Update available" banner when a new SW version is waiting.
 */

import { t, onLocaleChange } from '../i18n/index.ts';
import { onUpdateAvailable, applyUpdate } from './sw-register.ts';
import { onQueueChange } from './sync-manager.ts';

export type ConnectionState = 'online' | 'offline' | 'syncing';

type StateCallback = (state: ConnectionState) => void;

const stateListeners: StateCallback[] = [];
let currentState: ConnectionState = navigator.onLine ? 'online' : 'offline';

/** Subscribe to connection state changes. */
export function onConnectionStateChange(cb: StateCallback): void {
  stateListeners.push(cb);
}

/** Get current connection state. */
export function getConnectionState(): ConnectionState {
  return currentState;
}

/** Update the connection state and notify listeners. */
export function setConnectionState(state: ConnectionState): void {
  if (state === currentState) return;
  currentState = state;
  for (const cb of stateListeners) cb(state);
}

/** Build the offline indicator element for the toolbar. */
export function buildOfflineIndicator(): HTMLElement {
  const container = document.createElement('span');
  container.className = 'offline-indicator';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');

  function update(): void {
    container.textContent = '';
    container.className = 'offline-indicator';

    if (currentState === 'offline') {
      container.classList.add('offline-indicator--offline');
      container.textContent = t('offline.offline');
    } else if (currentState === 'syncing') {
      container.classList.add('offline-indicator--syncing');
      container.textContent = t('offline.syncing');
    }
    // When online + synced, indicator is hidden (empty)
  }

  update();
  onConnectionStateChange(update);
  onLocaleChange(update);

  // Show queued changes count when offline
  onQueueChange((count) => {
    if (currentState === 'offline' && count > 0) {
      container.textContent = `${t('offline.offline')} \u00b7 ${t('offline.queuedChanges', { count: String(count) })}`;
    }
  });

  return container;
}

/** Build the "Update available" banner. */
export function buildUpdateBanner(): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.hidden = true;
  banner.setAttribute('role', 'alert');

  const message = document.createElement('span');
  message.textContent = t('offline.updateAvailable');

  const btn = document.createElement('button');
  btn.className = 'update-banner-btn';
  btn.textContent = t('offline.updateAction');

  banner.appendChild(message);
  banner.appendChild(btn);

  onLocaleChange(() => {
    message.textContent = t('offline.updateAvailable');
    btn.textContent = t('offline.updateAction');
  });

  onUpdateAvailable((registration) => {
    banner.hidden = false;
    btn.onclick = () => {
      applyUpdate(registration);
      banner.hidden = true;
    };
  });

  return banner;
}

/** Initialize browser connectivity listeners. */
export function initConnectivityListeners(): void {
  window.addEventListener('online', () => {
    setConnectionState('online');
  });
  window.addEventListener('offline', () => {
    setConnectionState('offline');
  });
}
