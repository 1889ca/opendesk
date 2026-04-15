/** Contract: contracts/app/shell.md */

/**
 * Dashboard view: document list, folders, search, template picker.
 * Adapts the existing doc-list module for SPA mount/unmount lifecycle.
 * Delegates row rendering to doc-row.ts for icons, context menu, snippets,
 * keyboard navigation, and more-actions button.
 */

import { apiFetch } from '../shared/api-client.ts';
import { createDocumentFromTemplate } from '../doc-list/template-picker.ts';
import { t } from '../i18n/index.ts';
import { navigate } from '../shell/router.ts';
import {
  getCurrentFolderId,
  setNavigateCallback,
  renderBreadcrumbs,
  renderFolders,
  loadFolders,
  createNewFolderButton,
} from '../doc-list/folder-list.ts';
import { createGlobalSearch } from '../editor/global-search.ts';
import { renderDocuments, type DocEntry } from '../doc-list/doc-row.ts';
import { setupKeyboardNav } from '../doc-list/doc-list-keyboard.ts';

let listEl: HTMLElement | null = null;
let cleanupKeyboard: (() => void) | null = null;
let loadedDocs: DocEntry[] = [];

async function loadAll(container: HTMLElement) {
  const folderId = getCurrentFolderId();
  container.innerHTML = '';

  let breadcrumbEl = document.getElementById('folder-breadcrumbs');
  if (!breadcrumbEl) {
    breadcrumbEl = document.createElement('nav');
    breadcrumbEl.id = 'folder-breadcrumbs';
    container.parentElement?.insertBefore(breadcrumbEl, container);
  }
  renderBreadcrumbs(breadcrumbEl);

  try {
    const folders = await loadFolders(folderId);
    renderFolders(container, folders);

    const url = folderId
      ? '/api/documents?folderId=' + encodeURIComponent(folderId)
      : '/api/documents';
    const res = await apiFetch(url);
    const docs: DocEntry[] = await res.json();
    loadedDocs = docs;

    renderDocuments({
      listEl: container,
      docs,
      onDelete: () => { if (listEl) loadAll(listEl); },
      onNewDocument: () => createNewDoc(),
      selectedIds: new Set(),
      onSelectionChange: () => {},
    });

    // Set up keyboard navigation
    cleanupKeyboard?.();
    cleanupKeyboard = setupKeyboardNav(
      container,
      (id) => loadedDocs.find((d) => d.id === id),
      () => { if (listEl) loadAll(listEl); },
    );
  } catch (err) {
    console.error('Failed to load documents', err);
    const errWrapper = document.createElement('div');
    errWrapper.className = 'doc-list-empty';
    const errP = document.createElement('p');
    errP.className = 'empty-title';
    errP.textContent = t('docList.loadFailed');
    errWrapper.appendChild(errP);
    container.appendChild(errWrapper);
  }
}

async function createNewDoc(): Promise<void> {
  try {
    const docId = await createDocumentFromTemplate();
    if (docId) navigate('/doc/' + encodeURIComponent(docId));
  } catch (err: unknown) {
    console.error('Create failed', err);
  }
}

export async function mount(
  container: HTMLElement, _params: Record<string, string>,
): Promise<void> {
  const wrapper = document.createElement('div');
  wrapper.className = 'dashboard-view';

  const header = document.createElement('div');
  header.className = 'dashboard-header';

  const newBtn = document.createElement('button');
  newBtn.className = 'btn btn-primary';
  newBtn.id = 'new-doc-btn';
  newBtn.textContent = t('docList.newDocument');

  const folderBtnContainer = document.createElement('span');
  createNewFolderButton(folderBtnContainer);

  header.appendChild(folderBtnContainer);
  header.appendChild(newBtn);

  listEl = document.createElement('div');
  listEl.className = 'doc-list';
  listEl.id = 'doc-list';

  const searchEl = createGlobalSearch((active: boolean) => {
    listEl!.style.display = active ? 'none' : '';
    const breadcrumbs = document.getElementById('folder-breadcrumbs');
    if (breadcrumbs) breadcrumbs.style.display = active ? 'none' : '';
  });

  wrapper.appendChild(header);
  wrapper.appendChild(searchEl);
  wrapper.appendChild(listEl);
  container.appendChild(wrapper);

  setNavigateCallback(() => { if (listEl) loadAll(listEl); });

  newBtn.addEventListener('click', createNewDoc);

  const onCreateDoc = () => createNewDoc();
  document.addEventListener('opendesk:create-document', onCreateDoc);
  (wrapper as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    document.removeEventListener('opendesk:create-document', onCreateDoc);
    cleanupKeyboard?.();
    cleanupKeyboard = null;
  };

  await loadAll(listEl);
}

export function unmount(): void {
  const wrapper = document.querySelector(
    '.dashboard-view',
  ) as (HTMLElement & { _cleanup?: () => void }) | null;
  if (wrapper?._cleanup) wrapper._cleanup();

  const breadcrumbs = document.getElementById('folder-breadcrumbs');
  if (breadcrumbs) breadcrumbs.remove();

  listEl = null;
  loadedDocs = [];
}
