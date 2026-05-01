/** Contract: contracts/app/rules.md */

/**
 * Conflict resolution modal for offline/online divergence.
 *
 * Hocuspocus emits `synced` with `state: false` when the server rejects
 * or cannot reconcile the client's state vector. This is the entry point
 * for surface-level user notification — CRDT auto-merges handle the
 * majority of cases, but when the server explicitly diverges we need to
 * inform the user and give them agency over the resolution.
 *
 * Resolution options:
 *   "Keep mine" — reload the client state by re-applying local IndexedDB
 *     persistence and forcing a re-sync (CRDT merge favours local clock)
 *   "Keep theirs" — wipe local IndexedDB for this doc and reconnect fresh
 *   "Dismiss" — close without action (CRDT will eventually converge)
 */

import type { HocuspocusProvider } from '@hocuspocus/provider';
import { t } from '../i18n/index.ts';

let activeModal: HTMLElement | null = null;

function removeModal(): void {
  activeModal?.remove();
  activeModal = null;
}

/**
 * Show the conflict resolution modal. Safe to call multiple times —
 * only one modal exists at a time (duplicate calls are ignored).
 */
export function showConflictModal(provider: HocuspocusProvider): void {
  // Only one conflict modal at a time
  if (activeModal) return;

  const overlay = document.createElement('div');
  overlay.className = 'conflict-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'conflict-modal-title');
  overlay.setAttribute('aria-describedby', 'conflict-modal-body');

  const modal = document.createElement('div');
  modal.className = 'conflict-modal';

  const title = document.createElement('h2');
  title.id = 'conflict-modal-title';
  title.className = 'conflict-modal__title';
  title.textContent = t('conflict.title');

  const body = document.createElement('p');
  body.id = 'conflict-modal-body';
  body.className = 'conflict-modal__body';
  body.textContent = t('conflict.body');

  const actions = document.createElement('div');
  actions.className = 'conflict-modal__actions';

  const keepMineBtn = document.createElement('button');
  keepMineBtn.className = 'conflict-modal__btn conflict-modal__btn--primary';
  keepMineBtn.textContent = t('conflict.keepMine');
  keepMineBtn.addEventListener('click', () => {
    // Force re-sync: reconnect the provider so Hocuspocus exchanges state
    // vectors again. Local IndexedDB state was already replayed into the
    // Yjs doc on load, so the client's state vector is authoritative.
    removeModal();
    provider.disconnect();
    provider.connect();
  });

  const keepTheirsBtn = document.createElement('button');
  keepTheirsBtn.className = 'conflict-modal__btn conflict-modal__btn--secondary';
  keepTheirsBtn.textContent = t('conflict.keepTheirs');
  keepTheirsBtn.addEventListener('click', () => {
    // Drop local persistence for this doc and reload — the provider will
    // sync a fresh copy from the server
    removeModal();
    const docId = (provider as unknown as { configuration: { name: string } }).configuration.name;
    const dbName = `opendesk-yjs-${docId}`;
    const delReq = indexedDB.deleteDatabase(dbName);
    delReq.onsuccess = () => window.location.reload();
    delReq.onerror = () => window.location.reload();
    delReq.onblocked = () => window.location.reload();
  });

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'conflict-modal__btn conflict-modal__btn--ghost';
  dismissBtn.textContent = t('conflict.dismiss');
  dismissBtn.addEventListener('click', removeModal);

  // Dismiss on overlay click outside the modal card
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) removeModal();
  });

  // Dismiss on Escape
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { removeModal(); document.removeEventListener('keydown', keyHandler); }
  };
  document.addEventListener('keydown', keyHandler);

  actions.append(keepMineBtn, keepTheirsBtn, dismissBtn);
  modal.append(title, body, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  activeModal = overlay;
  keepMineBtn.focus();
}
