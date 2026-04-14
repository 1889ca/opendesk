/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';
import { createDocumentFromTemplate } from './template-picker.ts';
import { setNavigateCallback, getCurrentFolderId } from './folder-list.ts';
import { TYPE_META } from './doc-list-render.ts';
import { initTheme, buildThemeToggle } from '../shared/theme-toggle.ts';
import { buildNotificationBell } from '../shared/notification-bell.ts';
import { ensureNameConfirmed } from '../shared/name-setup.ts';
import { buildProfileChip } from '../shared/profile-chip.ts';
import { buildWorkspaceSidebar } from '../shared/workspace-sidebar.ts';
import { createGlobalSearch } from '../editor/global-search.ts';
import { createBulkActionBar } from './bulk-actions.ts';
import { showNameDialog } from './name-dialog.ts';
import {
  registerServiceWorker,
  buildOfflineIndicator,
  buildUpdateBanner,
  initConnectivityListeners,
} from '../offline/index.ts';
import { setupOnlineRefresh } from '../offline/doc-list-offline.ts';
import { type DocListState, loadViewMode } from './doc-list-controls.ts';
import { type LoaderState, loadDocuments } from './doc-list-loader.ts';
import { showToast } from '../shared/toast.ts';
import { initStarredCache } from './starred-store.ts';

const ls: LoaderState = {
  state: { sort: 'updated_at-desc', typeFilter: 'all', page: 1, totalPages: 1, viewMode: loadViewMode() },
  selectedIds: new Set<string>(),
  docIds: [],
  controlsEl: null,
  paginationEl: null,
  bulkBar: null,
  _escHandler: null,
  _observer: null,
  _loading: false,
};

function updateState(next: Partial<DocListState>): void {
  ls.state = { ...ls.state, ...next };
}

async function createTypedDocument(documentType: string): Promise<void> {
  const meta = TYPE_META[documentType] || TYPE_META.text;
  const labelKey =
    documentType === 'spreadsheet' ? 'docList.spreadsheetTitlePrompt' :
    documentType === 'presentation' ? 'docList.presentationTitlePrompt' :
    'docList.titlePrompt';
  const titleText = await showNameDialog(labelKey);
  if (!titleText) return;
  try {
    const res = await apiFetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleText, documentType }),
    });
    if (!res.ok) throw new Error('Failed to create document');
    const doc = await res.json();
    showToast('Document created', 'success');
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
  await ensureNameConfirmed();

  const sidebarSlot = document.getElementById('workspace-sidebar');
  if (sidebarSlot) sidebarSlot.replaceWith(buildWorkspaceSidebar());
  buildNotificationBell();

  const listEl = document.getElementById('doc-list');
  const newBtn = document.getElementById('new-doc-btn');
  const toolbarRight = document.querySelector('.toolbar-right');
  if (!listEl || !newBtn) return;

  if (toolbarRight) {
    toolbarRight.prepend(buildOfflineIndicator());
    toolbarRight.appendChild(buildProfileChip());
  }
  document.body.insertBefore(buildUpdateBanner(), document.body.firstChild);

  async function handleNewDocument() {
    try {
      const docId = await createDocumentFromTemplate();
      if (docId) {
        showToast('Document created', 'success');
        window.location.href = '/editor.html?doc=' + encodeURIComponent(docId);
      }
    } catch (err) { console.error('Create failed', err); }
  }

  const reload = () => loadDocuments(listEl, ls, handleNewDocument, updateState, reload);
  setupOnlineRefresh(reload);

  await initStarredCache();

  const searchEl = createGlobalSearch((active) => {
    listEl.style.display = active ? 'none' : '';
    const breadcrumbs = document.getElementById('folder-breadcrumbs');
    if (breadcrumbs) breadcrumbs.style.display = active ? 'none' : '';
    if (ls.controlsEl) ls.controlsEl.style.display = active ? 'none' : '';
    const sentinel = listEl.parentElement?.querySelector('.doc-list-sentinel') as HTMLElement | null;
    if (sentinel) sentinel.style.display = active ? 'none' : '';
  });
  listEl.parentElement?.insertBefore(searchEl, listEl);

  ls.bulkBar = createBulkActionBar(reload);
  listEl.parentElement?.insertBefore(ls.bulkBar.el, listEl);

  setNavigateCallback(() => { updateState({ page: 1 }); reload(); });
  newBtn.addEventListener('click', handleNewDocument);
  registerNewDocShortcut(handleNewDocument);

  document.getElementById('new-sheet-btn')
    ?.addEventListener('click', () => createTypedDocument('spreadsheet'));
  document.getElementById('new-slides-btn')
    ?.addEventListener('click', () => createTypedDocument('presentation'));

  // New folder button in create dropdown
  document.getElementById('new-folder-btn')?.addEventListener('click', async () => {
    const name = await showNameDialog('folders.namePrompt');
    if (!name) return;
    try {
      await apiFetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: getCurrentFolderId() }),
      });
      reload();
    } catch (err) { console.error('Create folder failed', err); }
  });

  // Create dropdown toggle
  const createBtn = document.getElementById('create-btn');
  const createMenu = document.getElementById('create-menu');
  if (createBtn && createMenu) {
    createBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !createMenu.hidden;
      createMenu.hidden = open;
      createBtn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', () => { createMenu.hidden = true; });
    createMenu.addEventListener('click', () => { createMenu.hidden = true; });
  }

  reload();
}

document.addEventListener('DOMContentLoaded', init);
