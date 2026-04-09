/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';
import { createDocumentFromTemplate } from './template-picker.ts';
import { t } from '../i18n/index.ts';
import {
  getCurrentFolderId,
  setNavigateCallback,
  renderBreadcrumbs,
  renderFolders,
  loadFolders,
  createNewFolderButton,
} from './folder-list.ts';
import { initTheme, buildThemeToggle } from '../shared/theme-toggle.ts';
import { buildNotificationBell } from '../shared/notification-bell.ts';
import { ensureNameConfirmed } from '../shared/name-setup.ts';
import { buildProfileChip } from '../shared/profile-chip.ts';
import { buildWorkspaceSidebar } from '../shared/workspace-sidebar.ts';
import { createGlobalSearch } from '../editor/global-search.ts';
import { renderDocuments, TYPE_META } from './doc-list-render.ts';
import { createBulkActionBar } from './bulk-actions.ts';
import { showNameDialog } from './name-dialog.ts';
import {
  registerServiceWorker,
  buildOfflineIndicator,
  buildUpdateBanner,
  initConnectivityListeners,
} from '../offline/index.ts';
import {
  cacheDocListResponse,
  renderCachedDocuments,
  setupOnlineRefresh,
} from '../offline/doc-list-offline.ts';
import {
  type DocListState,
  type SortOption,
  type TypeFilter,
  buildApiUrl,
  createControlsBar,
  createPaginationBar,
} from './doc-list-controls.ts';

let selectedIds: Set<string> = new Set();
let bulkBar: ReturnType<typeof createBulkActionBar> | null = null;
let controlsEl: HTMLElement | null = null;
let paginationEl: HTMLElement | null = null;

let state: DocListState = {
  sort: 'updated_at-desc',
  typeFilter: 'all',
  page: 1,
  totalPages: 1,
};

function updateState(next: Partial<DocListState>): void {
  state = { ...state, ...next };
}

function rebuildControls(listEl: HTMLElement, onNewDocument: () => void): void {
  const parent = listEl.parentElement;
  if (!parent) return;
  if (controlsEl) controlsEl.remove();
  controlsEl = createControlsBar(state, (next) => {
    updateState(next);
    loadAll(listEl, onNewDocument);
  });
  const breadcrumbEl = document.getElementById('folder-breadcrumbs');
  if (breadcrumbEl?.nextSibling) {
    parent.insertBefore(controlsEl, breadcrumbEl.nextSibling);
  } else {
    parent.insertBefore(controlsEl, listEl);
  }
}

function rebuildPagination(listEl: HTMLElement, onNewDocument: () => void): void {
  const parent = listEl.parentElement;
  if (!parent) return;
  if (paginationEl) paginationEl.remove();
  if (state.totalPages <= 1) return;
  paginationEl = createPaginationBar(state, (next) => {
    updateState(next);
    loadAll(listEl, onNewDocument);
  });
  parent.insertBefore(paginationEl, listEl.nextSibling);
}

async function loadAll(listEl: HTMLElement, onNewDocument: () => void) {
  const folderId = getCurrentFolderId();
  listEl.innerHTML = '';
  selectedIds = new Set();
  bulkBar?.update(selectedIds);

  let breadcrumbEl = document.getElementById('folder-breadcrumbs');
  if (!breadcrumbEl) {
    breadcrumbEl = document.createElement('nav');
    breadcrumbEl.id = 'folder-breadcrumbs';
    listEl.parentElement?.insertBefore(breadcrumbEl, listEl);
  }
  renderBreadcrumbs(breadcrumbEl);
  rebuildControls(listEl, onNewDocument);

  try {
    const folders = await loadFolders(folderId);
    renderFolders(listEl, folders);

    const baseUrl = folderId
      ? '/api/documents?folderId=' + encodeURIComponent(folderId)
      : '/api/documents';
    const url = buildApiUrl(baseUrl, state);
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const json = await res.json();

    // Support both paginated ({data, pagination}) and legacy (array) responses
    const docs = Array.isArray(json) ? json : (json.data ?? []);
    const pagination = json.pagination ?? null;

    cacheDocListResponse(docs);
    renderDocuments({
      listEl,
      docs,
      onDelete: () => loadAll(listEl, onNewDocument),
      onNewDocument,
      selectedIds,
      onSelectionChange: (ids) => {
        selectedIds = ids;
        bulkBar?.update(ids);
      },
    });

    if (pagination) {
      updateState({ totalPages: pagination.totalPages, page: pagination.page });
      rebuildPagination(listEl, onNewDocument);
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

async function createTypedDocument(documentType: string): Promise<void> {
  const meta = TYPE_META[documentType] || TYPE_META.text;
  const titleText = await showNameDialog('docList.titlePrompt');
  if (!titleText) return;
  try {
    const res = await apiFetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleText, documentType }),
    });
    if (!res.ok) throw new Error('Failed to create document');
    const doc = await res.json();
    window.location.href = meta.editor + '?doc=' + encodeURIComponent(doc.id);
  } catch (err) {
    console.error('Create failed', err);
  }
}

function registerNewDocShortcut(onCreate: () => void): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.key !== 'n' && e.key !== 'N') || ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable) return;
    e.preventDefault(); onCreate();
  });
}

async function init() {
  initTheme();
  initConnectivityListeners();
  registerServiceWorker();

  // Block until user has set a display name (issue #170)
  await ensureNameConfirmed();

  const sidebarSlot = document.getElementById('workspace-sidebar');
  if (sidebarSlot) sidebarSlot.replaceWith(buildWorkspaceSidebar());

  buildThemeToggle(); buildNotificationBell();

  const listEl = document.getElementById('doc-list');
  const newBtn = document.getElementById('new-doc-btn');
  if (!listEl || !newBtn) return;
  const toolbarRight = document.querySelector('.toolbar-right');

  if (toolbarRight) {
    toolbarRight.prepend(buildOfflineIndicator());
    createNewFolderButton(toolbarRight as HTMLElement);
    toolbarRight.appendChild(buildProfileChip());
  }
  document.body.insertBefore(buildUpdateBanner(), document.body.firstChild);
  setupOnlineRefresh(() => loadAll(listEl, handleNewDocument));

  const d = (el: HTMLElement | null, active: boolean) => { if (el) el.style.display = active ? 'none' : ''; };
  const searchEl = createGlobalSearch((active) => {
    d(listEl, active); d(document.getElementById('folder-breadcrumbs'), active);
    d(controlsEl, active); d(paginationEl, active);
  });
  listEl.parentElement?.insertBefore(searchEl, listEl);

  // Bulk action bar — inserted above the list
  bulkBar = createBulkActionBar(() => loadAll(listEl, handleNewDocument));
  listEl.parentElement?.insertBefore(bulkBar.el, listEl);

  async function handleNewDocument() {
    try {
      const docId = await createDocumentFromTemplate();
      if (docId) window.location.href = '/editor.html?doc=' + encodeURIComponent(docId);
    } catch (err) { console.error('Create failed', err); }
  }

  setNavigateCallback(() => { updateState({ page: 1 }); loadAll(listEl, handleNewDocument); });
  newBtn.addEventListener('click', handleNewDocument);
  registerNewDocShortcut(handleNewDocument);

  document.getElementById('new-sheet-btn')
    ?.addEventListener('click', () => createTypedDocument('spreadsheet'));
  document.getElementById('new-slides-btn')
    ?.addEventListener('click', () => createTypedDocument('presentation'));

  loadAll(listEl, handleNewDocument);
}

document.addEventListener('DOMContentLoaded', init);
