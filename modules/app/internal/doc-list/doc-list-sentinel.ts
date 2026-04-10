/** Contract: contracts/app/rules.md */

/**
 * Infinite scroll sentinel helpers for the document list (issue #299).
 * Manages an IntersectionObserver-based sentinel element placed after the list.
 */

import { t } from '../i18n/index.ts';
import type { LoaderState } from './doc-list-loader.ts';

export function attachSentinel(
  listEl: HTMLElement,
  ls: LoaderState,
  loadNextPage: () => Promise<void>,
): void {
  // Disconnect any previous observer before attaching a new one
  ls._observer?.disconnect();
  ls._observer = null;

  const sentinel = document.createElement('div');
  sentinel.className = 'doc-list-sentinel';
  listEl.parentElement?.insertBefore(sentinel, listEl.nextSibling);

  const observer = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting || ls._loading) return;
    loadNextPage();
  }, { threshold: 0.1 });

  observer.observe(sentinel);
  ls._observer = observer;
}

export function removeSentinel(listEl: HTMLElement, ls: LoaderState): void {
  ls._observer?.disconnect();
  ls._observer = null;
  const existing = listEl.parentElement?.querySelector('.doc-list-sentinel');
  existing?.remove();
}

export function setSentinelState(listEl: HTMLElement, loading: boolean): void {
  const sentinel = listEl.parentElement?.querySelector('.doc-list-sentinel') as HTMLElement | null;
  if (!sentinel) return;
  sentinel.textContent = loading ? t('docList.loading') : '';
  sentinel.classList.toggle('doc-list-sentinel--loading', loading);
}
