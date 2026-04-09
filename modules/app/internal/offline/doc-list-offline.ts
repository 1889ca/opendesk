/** Contract: contracts/app/offline.md */

/**
 * Offline integration for the document list.
 * Caches fetched documents for offline display and renders
 * cached documents with offline badges when network is unavailable.
 */

import { t } from '../i18n/index.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { cacheDocumentList, getCachedDocumentList } from './offline-storage.ts';
import { getConnectionState, onConnectionStateChange } from './offline-indicator.ts';
import type { CachedDocEntry } from './offline-storage.ts';

interface DocEntry {
  id: string;
  title: string;
  updated_at: string;
  document_type?: string;
}

const TYPE_EDITORS: Record<string, string> = {
  text: '/editor.html',
  spreadsheet: '/spreadsheet.html',
  presentation: '/presentation.html',
};

/** Cache documents after a successful API fetch. */
export function cacheDocListResponse(docs: DocEntry[]): void {
  cacheDocumentList(docs.map((d) => ({
    id: d.id,
    title: d.title,
    updated_at: d.updated_at,
    cached_at: Date.now(),
  }))).catch((err) => console.warn('Failed to cache doc list:', err));
}

/** Render cached documents with offline badges when network is down. */
export async function renderCachedDocuments(listEl: HTMLElement): Promise<boolean> {
  if (getConnectionState() !== 'offline') return false;

  let docs: CachedDocEntry[];
  try {
    docs = await getCachedDocumentList();
  } catch {
    return false;
  }

  if (!docs.length) return false;

  const notice = document.createElement('div');
  notice.className = 'doc-list-offline-notice';
  notice.textContent = t('offline.cachedDocs');
  listEl.appendChild(notice);

  for (const doc of docs) {
    const editor = TYPE_EDITORS.text;
    const row = document.createElement('a');
    row.className = 'doc-row doc-row--offline';
    row.href = editor + '?doc=' + encodeURIComponent(doc.id);

    const info = document.createElement('div');
    info.className = 'doc-row-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'doc-row-title-row';

    const title = document.createElement('span');
    title.className = 'doc-row-title';
    title.textContent = doc.title || t('editor.untitled');

    const badge = document.createElement('span');
    badge.className = 'doc-row-offline-badge';
    badge.textContent = t('offline.badge');

    titleRow.append(title, badge);

    const time = document.createElement('span');
    time.className = 'doc-row-time';
    time.textContent = t('docList.updated', { time: formatRelativeTime(doc.updated_at) });

    info.append(titleRow, time);
    row.appendChild(info);
    listEl.appendChild(row);
  }

  return true;
}

/** Set up auto-refresh of doc list when coming back online. */
export function setupOnlineRefresh(reloadFn: () => void): void {
  onConnectionStateChange((state) => {
    if (state === 'online') reloadFn();
  });
}
