/** Contract: contracts/app/offline.md */

/**
 * Offline status indicator component.
 * Shows connection state in the toolbar: Offline / Syncing / Synced.
 * Also shows an "Update available" banner when a new SW version is waiting.
 * Tracks both the HTTP mutation queue count and the Yjs unsynced-change count.
 */

import { t, onLocaleChange } from '../i18n/index.ts';
import { onUpdateAvailable, applyUpdate } from './sw-register.ts';
import { onQueueChange } from './sync-manager.ts';

export type ConnectionState = 'online' | 'offline' | 'syncing';

type StateCallback = (state: ConnectionState) => void;
type YjsCountCallback = (count: number) => void;

const stateListeners: StateCallback[] = [];
const yjsCountListeners: YjsCountCallback[] = [];
let currentState: ConnectionState = navigator.onLine ? 'online' : 'offline';
let currentYjsCount = 0;

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

/**
 * Report how many Yjs operations are queued but not yet acknowledged by the
 * server. Called by editor-collab.ts on the provider's `unsyncedChanges` event
 * so the indicator can show "Offline — N edit(s) queued" accurately.
 */
export function setYjsQueueCount(count: number): void {
  currentYjsCount = count;
  for (const cb of yjsCountListeners) cb(count);
}

/** Build the offline indicator element for the toolbar. */
export function buildOfflineIndicator(): HTMLElement {
  const container = document.createElement('span');
  container.className = 'offline-indicator';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'true');

  function render(): void {
    container.textContent = '';
    container.className = 'offline-indicator';

    if (currentState === 'offline') {
      container.classList.add('offline-indicator--offline');
      if (currentYjsCount > 0) {
        container.textContent = `${t('offline.offline')} \u00b7 ${t('offline.yjsQueued', { count: String(currentYjsCount) })}`;
      } else {
        container.textContent = t('offline.offline');
      }
    } else if (currentState === 'syncing') {
      container.classList.add('offline-indicator--syncing');
      container.textContent = t('offline.syncing');
    }
    // When online + synced, indicator is hidden (empty)
  }

  render();
  onConnectionStateChange(render);
  yjsCountListeners.push(render);
  onLocaleChange(render);

  // HTTP mutation queue also contributes when offline
  onQueueChange((count) => {
    if (currentState === 'offline' && count > 0 && currentYjsCount === 0) {
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
