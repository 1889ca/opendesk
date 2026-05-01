/** Contract: contracts/app/offline.md */

/**
 * Offline module barrel export.
 * Provides service worker registration, offline indicator UI,
 * IndexedDB storage helpers, and mutation sync management.
 */

export { registerServiceWorker, onUpdateAvailable, applyUpdate } from './sw-register.ts';
export {
  buildOfflineIndicator,
  buildUpdateBanner,
  initConnectivityListeners,
  setConnectionState,
  getConnectionState,
  onConnectionStateChange,
  setYjsQueueCount,
} from './offline-indicator.ts';
export type { ConnectionState } from './offline-indicator.ts';
export {
  cacheDocumentList,
  getCachedDocumentList,
  saveSidebarState,
  loadSidebarState,
  cacheNotifications,
  getCachedNotifications,
} from './offline-storage.ts';
export type { CachedDocEntry } from './offline-storage.ts';
export { queueMutation, getQueueSize, flushQueue, onQueueChange } from './sync-manager.ts';
export { attachYjsPersistence } from './yjs-persistence.ts';
export type { YjsPersistenceHandle } from './yjs-persistence.ts';
