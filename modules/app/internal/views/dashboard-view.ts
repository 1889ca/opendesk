/** Contract: contracts/app/shell.md */

/**
 * Dashboard view: document list, folders, search, template picker.
 * Adapts the existing doc-list module for SPA mount/unmount lifecycle.
 */

import { apiFetch } from '../shared/api-client.ts';
import { createDocumentFromTemplate } from '../doc-list/template-picker.ts';
import { t } from '../i18n/index.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
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
import { showDeleteConfirmDialog } from '../doc-list/delete-confirm-dialog.ts';

interface DocEntry {
  id: string;
  title: string;
  updated_at: string;
}

let listEl: HTMLElement | null = null;

function renderDocuments(container: HTMLElement, docs: DocEntry[]) {
  if (!docs.length) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'doc-list-empty';
    const key = getCurrentFolderId() ? 'folders.empty' : 'docList.noDocuments';
    const emptyTitle = document.createElement('p');
    emptyTitle.className = 'empty-title';
    emptyTitle.textContent = t(key);
    const emptySub = document.createElement('p');
    emptySub.className = 'empty-subtitle';
    emptySub.textContent = t('docList.noDocumentsSubtitle');
    emptyEl.appendChild(emptyTitle);
    emptyEl.appendChild(emptySub);
    container.appendChild(emptyEl);
    return;
  }

  for (const doc of docs) {
    const row = document.createElement('a');
    row.className = 'doc-row';
    row.href = '/doc/' + encodeURIComponent(doc.id);

    const info = document.createElement('div');
    info.className = 'doc-row-info';

    const title = document.createElement('span');
    title.className = 'doc-row-title';
    title.textContent = doc.title || t('editor.untitled');

    const time = document.createElement('span');
    time.className = 'doc-row-time';
    time.textContent = t('docList.updated', { time: formatRelativeTime(doc.updated_at) });

    info.appendChild(title);
    info.appendChild(time);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-delete';
    deleteBtn.textContent = t('docList.delete');
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = doc.title || t('editor.untitled');
      showDeleteConfirmDialog(name).then((confirmed) => {
        if (!confirmed) return;
        apiFetch('/api/documents/' + encodeURIComponent(doc.id), { method: 'DELETE' })
          .then(() => { if (listEl) loadAll(listEl); })
          .catch((err: unknown) => { console.error('Delete failed', err); });
      });
    });

    row.appendChild(info);
    row.appendChild(deleteBtn);
    container.appendChild(row);
  }
}

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
    renderDocuments(container, docs);
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

export async function mount(container: HTMLElement, _params: Record<string, string>): Promise<void> {
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

  newBtn.addEventListener('click', async () => {
    try {
      const docId = await createDocumentFromTemplate();
      if (docId) {
        navigate('/doc/' + encodeURIComponent(docId));
      }
    } catch (err: unknown) {
      console.error('Create failed', err);
    }
  });

  // Listen for create-document events from the sidebar
  const onCreateDoc = async () => {
    try {
      const docId = await createDocumentFromTemplate();
      if (docId) {
        navigate('/doc/' + encodeURIComponent(docId));
      }
    } catch (err: unknown) {
      console.error('Create failed', err);
    }
  };
  document.addEventListener('opendesk:create-document', onCreateDoc);
  (wrapper as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    document.removeEventListener('opendesk:create-document', onCreateDoc);
  };

  await loadAll(listEl);
}

export function unmount(): void {
  const wrapper = document.querySelector('.dashboard-view') as HTMLElement & { _cleanup?: () => void } | null;
  if (wrapper?._cleanup) wrapper._cleanup();

  // Remove breadcrumbs that were inserted outside our container
  const breadcrumbs = document.getElementById('folder-breadcrumbs');
  if (breadcrumbs) breadcrumbs.remove();

  listEl = null;
}
