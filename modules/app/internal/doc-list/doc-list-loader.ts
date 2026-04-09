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
import { renderDocuments, renderDocumentsGrid } from './doc-list-render.ts';
import {
  cacheDocListResponse,
  renderCachedDocuments,
} from '../offline/doc-list-offline.ts';
import {
  type DocListState,
  buildApiUrl,
  createControlsBar,
} from './doc-list-controls.ts';
import {
  attachSentinel,
  removeSentinel,
  setSentinelState,
} from './doc-list-sentinel.ts';
import type { createBulkActionBar } from './bulk-actions.ts';

export interface LoaderState {
  state: DocListState;
  selectedIds: Set<string>;
  docIds: string[];
  controlsEl: HTMLElement | null;
  paginationEl: HTMLElement | null;
  bulkBar: ReturnType<typeof createBulkActionBar> | null;
  _escHandler: ((e: KeyboardEvent) => void) | null;
  _observer: IntersectionObserver | null;
  _loading: boolean;
}

export function rebuildControls(
  listEl: HTMLElement,
  ls: LoaderState,
  onNewDocument: () => void,
  updateState: (next: Partial<DocListState>) => void,
  reload: () => void,
  onSelectionChange?: (ids: Set<string>) => void,
): void {
  const parent = listEl.parentElement;
  if (!parent) return;
  if (ls.controlsEl) ls.controlsEl.remove();
  const selectAllOptions = onSelectionChange
    ? { docIds: ls.docIds, selectedIds: ls.selectedIds, onSelectionChange }
    : undefined;
  ls.controlsEl = createControlsBar(ls.state, (next) => { updateState(next); reload(); }, selectAllOptions);
  const breadcrumbEl = document.getElementById('folder-breadcrumbs');
  if (breadcrumbEl?.nextSibling) {
    parent.insertBefore(ls.controlsEl, breadcrumbEl.nextSibling);
  } else {
    parent.insertBefore(ls.controlsEl, listEl);
  }
}

export async function loadDocuments(
  listEl: HTMLElement,
  ls: LoaderState,
  onNewDocument: () => void,
  updateState: (next: Partial<DocListState>) => void,
  reload: () => void,
): Promise<void> {
  const isFirstPage = ls.state.page === 1;
  const folderId = getCurrentFolderId();

  if (isFirstPage) {
    listEl.innerHTML = '';
    ls.selectedIds = new Set();
    ls.docIds = [];
    ls.bulkBar?.update(ls.selectedIds);
    removeSentinel(listEl, ls);
  }

  ls._loading = true;
  if (!isFirstPage) setSentinelState(listEl, true);

  const handleSelectionChange = (ids: Set<string>): void => {
    ls.selectedIds = ids;
    ls.bulkBar?.update(ids);
    rebuildControls(listEl, ls, onNewDocument, updateState, reload, handleSelectionChange);
  };

  // Register Escape key handler once per loader lifecycle
  if (!ls._escHandler) {
    ls._escHandler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (ls.selectedIds.size === 0) return;
      ls.selectedIds = new Set();
      ls.bulkBar?.update(ls.selectedIds);
      rebuildControls(listEl, ls, onNewDocument, updateState, reload, handleSelectionChange);
    };
    document.addEventListener('keydown', ls._escHandler);
  }

  if (isFirstPage) {
    let breadcrumbEl = document.getElementById('folder-breadcrumbs');
    if (!breadcrumbEl) {
      breadcrumbEl = document.createElement('nav');
      breadcrumbEl.id = 'folder-breadcrumbs';
      listEl.parentElement?.insertBefore(breadcrumbEl, listEl);
    }
    renderBreadcrumbs(breadcrumbEl);
    rebuildControls(listEl, ls, onNewDocument, updateState, reload, handleSelectionChange);
  }

  try {
    if (isFirstPage) {
      const folders = await loadFolders(folderId);
      renderFolders(listEl, folders);
    }

    const baseUrl = folderId
      ? '/api/documents?folderId=' + encodeURIComponent(folderId)
      : '/api/documents';
    const url = buildApiUrl(baseUrl, ls.state);
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const json = await res.json();

    const docs = Array.isArray(json) ? json : (json.data ?? []);
    const pagination = json.pagination ?? null;

    const newIds = docs.map((d: { id: string }) => d.id);
    ls.docIds = isFirstPage ? newIds : [...ls.docIds, ...newIds];
    cacheDocListResponse(docs);

    if (ls.state.viewMode === 'grid') {
      renderDocumentsGrid({
        listEl, docs, onDelete: reload,
        selectedIds: ls.selectedIds,
        onSelectionChange: handleSelectionChange,
        append: !isFirstPage,
      });
    } else {
      renderDocuments({
        listEl, docs, onDelete: reload, onNewDocument,
        selectedIds: ls.selectedIds,
        onSelectionChange: handleSelectionChange,
        append: !isFirstPage,
      });
    }

    if (pagination) {
      updateState({ totalPages: pagination.totalPages, page: pagination.page, totalCount: pagination.total });
      if (isFirstPage) {
        rebuildControls(listEl, ls, onNewDocument, updateState, reload, handleSelectionChange);
      }

      const allLoaded = ls.state.page >= ls.state.totalPages;
      if (allLoaded) {
        removeSentinel(listEl, ls);
      } else {
        const loadNextPage = async (): Promise<void> => {
          if (ls._loading) return;
          updateState({ page: ls.state.page + 1 });
          await loadDocuments(listEl, ls, onNewDocument, updateState, reload);
        };
        if (isFirstPage) {
          attachSentinel(listEl, ls, loadNextPage);
        } else {
          setSentinelState(listEl, false);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load documents', err);
    if (isFirstPage) {
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
    removeSentinel(listEl, ls);
  } finally {
    ls._loading = false;
  }
}
