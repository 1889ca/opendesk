/** Contract: contracts/app/rules.md */
/**
 * doc-list-loader — data loading and UI rebuild helpers for the document list.
 * Separated from doc-list.ts to satisfy the 200-line limit.
 */
import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import {
  getCurrentFolderId,
  renderBreadcrumbs,
  renderFolders,
  loadFolders,
} from './folder-list.ts';
import { renderDocuments } from './doc-list-render.ts';
import {
  cacheDocListResponse,
  renderCachedDocuments,
} from '../offline/doc-list-offline.ts';
import {
  type DocListState,
  buildApiUrl,
  createControlsBar,
  createPaginationBar,
} from './doc-list-controls.ts';
import type { createBulkActionBar } from './bulk-actions.ts';

export interface LoaderState {
  state: DocListState;
  selectedIds: Set<string>;
  controlsEl: HTMLElement | null;
  paginationEl: HTMLElement | null;
  bulkBar: ReturnType<typeof createBulkActionBar> | null;
}

export function rebuildControls(
  listEl: HTMLElement,
  ls: LoaderState,
  onNewDocument: () => void,
  updateState: (next: Partial<DocListState>) => void,
  reload: () => void,
): void {
  const parent = listEl.parentElement;
  if (!parent) return;
  if (ls.controlsEl) ls.controlsEl.remove();
  ls.controlsEl = createControlsBar(ls.state, (next) => { updateState(next); reload(); });
  const breadcrumbEl = document.getElementById('folder-breadcrumbs');
  if (breadcrumbEl?.nextSibling) {
    parent.insertBefore(ls.controlsEl, breadcrumbEl.nextSibling);
  } else {
    parent.insertBefore(ls.controlsEl, listEl);
  }
}

export function rebuildPagination(
  listEl: HTMLElement,
  ls: LoaderState,
  updateState: (next: Partial<DocListState>) => void,
  reload: () => void,
): void {
  const parent = listEl.parentElement;
  if (!parent) return;
  if (ls.paginationEl) ls.paginationEl.remove();
  if (ls.state.totalPages <= 1) return;
  ls.paginationEl = createPaginationBar(ls.state, (next) => { updateState(next); reload(); });
  parent.insertBefore(ls.paginationEl, listEl.nextSibling);
}

export async function loadDocuments(
  listEl: HTMLElement,
  ls: LoaderState,
  onNewDocument: () => void,
  updateState: (next: Partial<DocListState>) => void,
  reload: () => void,
): Promise<void> {
  const folderId = getCurrentFolderId();
  listEl.innerHTML = '';
  ls.selectedIds = new Set();
  ls.bulkBar?.update(ls.selectedIds);

  let breadcrumbEl = document.getElementById('folder-breadcrumbs');
  if (!breadcrumbEl) {
    breadcrumbEl = document.createElement('nav');
    breadcrumbEl.id = 'folder-breadcrumbs';
    listEl.parentElement?.insertBefore(breadcrumbEl, listEl);
  }
  renderBreadcrumbs(breadcrumbEl);
  rebuildControls(listEl, ls, onNewDocument, updateState, reload);

  try {
    const folders = await loadFolders(folderId);
    renderFolders(listEl, folders);

    const baseUrl = folderId
      ? '/api/documents?folderId=' + encodeURIComponent(folderId)
      : '/api/documents';
    const url = buildApiUrl(baseUrl, ls.state);
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const json = await res.json();

    const docs = Array.isArray(json) ? json : (json.data ?? []);
    const pagination = json.pagination ?? null;

    cacheDocListResponse(docs);
    renderDocuments({
      listEl,
      docs,
      onDelete: reload,
      onNewDocument,
      selectedIds: ls.selectedIds,
      onSelectionChange: (ids) => { ls.selectedIds = ids; ls.bulkBar?.update(ids); },
    });

    if (pagination) {
      updateState({ totalPages: pagination.totalPages, page: pagination.page });
      rebuildPagination(listEl, ls, updateState, reload);
    }
  } catch (err) {
    console.error('Failed to load documents', err);
    const cached = await renderCachedDocuments(listEl);
    if (!cached) {
      const errDiv = document.createElement('div');
      errDiv.className = 'doc-list-empty';
      const errP = document.createElement('p');
      errP.className = 'empty-title';
      errP.textContent = t('docList.loadFailed');
      errDiv.appendChild(errP);
      listEl.replaceChildren(errDiv);
    }
  }
}
