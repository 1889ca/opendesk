/** Contract: contracts/app/offline.md */

/**
 * Service worker registration, update detection, and lifecycle management.
 * Registers sw.js, listens for updates, and notifies the UI when a new
 * version is waiting to activate.
 */

type UpdateCallback = (registration: ServiceWorkerRegistration) => void;

const updateListeners: UpdateCallback[] = [];

/** Subscribe to "update available" events. */
export function onUpdateAvailable(cb: UpdateCallback): void {
  updateListeners.push(cb);
}

function notifyUpdate(reg: ServiceWorkerRegistration): void {
  for (const cb of updateListeners) cb(reg);
}

/** Tell the waiting service worker to skip waiting and take over. */
export function applyUpdate(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

/** Register the service worker and set up update detection. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    // Check for waiting worker on page load (e.g., user refreshed)
    if (registration.waiting) {
      notifyUpdate(registration);
    }

    // Listen for new worker installing
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          notifyUpdate(registration);
        }
      });
    });

    // Reload page when controller changes (new SW activated)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}
