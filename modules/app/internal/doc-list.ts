/** Contract: contracts/app/rules.md */

import { apiFetch } from './api-client.ts';
import { createDocumentFromTemplate } from './template-picker.ts';
import { t } from './i18n/index.ts';
import { formatRelativeTime } from './time-format.ts';
import {
  getCurrentFolderId,
  setNavigateCallback,
  renderBreadcrumbs,
  renderFolders,
  loadFolders,
  createNewFolderButton,
} from './folder-list.ts';
import { initTheme } from './theme-toggle.ts';
import { createGlobalSearch } from './global-search.ts';

interface DocEntry {
  id: string;
  title: string;
  updated_at: string;
}

function renderDocuments(listEl: HTMLElement, docs: DocEntry[]) {
  if (!docs.length) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'doc-list-empty';
    const key = getCurrentFolderId() ? 'folders.empty' : 'docList.noDocuments';
    const titleP = document.createElement('p');
    titleP.className = 'empty-title';
    titleP.textContent = t(key);
    const subtitleP = document.createElement('p');
    subtitleP.className = 'empty-subtitle';
    subtitleP.textContent = t('docList.noDocumentsSubtitle');
    emptyEl.append(titleP, subtitleP);
    listEl.appendChild(emptyEl);
    return;
  }

  for (const doc of docs) {
    const row = document.createElement('a');
    row.className = 'doc-row';
    row.href = '/editor.html?doc=' + encodeURIComponent(doc.id);

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
      if (!confirm(t('docList.deleteConfirm', { name }))) return;
      apiFetch('/api/documents/' + encodeURIComponent(doc.id), { method: 'DELETE' })
        .then(() => { loadAll(listEl); })
        .catch((err) => { console.error('Delete failed', err); });
    });

    row.appendChild(info);
    row.appendChild(deleteBtn);
    listEl.appendChild(row);
  }
}

async function loadAll(listEl: HTMLElement) {
  const folderId = getCurrentFolderId();
  listEl.innerHTML = '';

  // Render breadcrumbs
  let breadcrumbEl = document.getElementById('folder-breadcrumbs');
  if (!breadcrumbEl) {
    breadcrumbEl = document.createElement('nav');
    breadcrumbEl.id = 'folder-breadcrumbs';
    listEl.parentElement?.insertBefore(breadcrumbEl, listEl);
  }
  renderBreadcrumbs(breadcrumbEl);

  try {
    const folders = await loadFolders(folderId);
    renderFolders(listEl, folders);

    const url = folderId
      ? '/api/documents?folderId=' + encodeURIComponent(folderId)
      : '/api/documents';
    const res = await apiFetch(url);
    const docs: DocEntry[] = await res.json();
    renderDocuments(listEl, docs);
  } catch (err) {
    console.error('Failed to load documents', err);
    const errDiv = document.createElement('div');
    errDiv.className = 'doc-list-empty';
    const errP = document.createElement('p');
    errP.className = 'empty-title';
    errP.textContent = t('docList.loadFailed');
    errDiv.appendChild(errP);
    listEl.replaceChildren(errDiv);
  }
}

function init() {
  initTheme();
  const listEl = document.getElementById('doc-list');
  const newBtn = document.getElementById('new-doc-btn');
  const toolbarRight = document.querySelector('.toolbar-right');
  if (!listEl || !newBtn) return;

  if (toolbarRight) {
    createNewFolderButton(toolbarRight as HTMLElement);
  }

  // Global search — insert before the doc list
  const searchEl = createGlobalSearch((active) => {
    listEl.style.display = active ? 'none' : '';
    const breadcrumbs = document.getElementById('folder-breadcrumbs');
    if (breadcrumbs) breadcrumbs.style.display = active ? 'none' : '';
  });
  listEl.parentElement?.insertBefore(searchEl, listEl);

  setNavigateCallback(() => loadAll(listEl));

  newBtn.addEventListener('click', async () => {
    try {
      const docId = await createDocumentFromTemplate();
      if (docId) {
        window.location.href = '/editor.html?doc=' + encodeURIComponent(docId);
      }
    } catch (err) {
      console.error('Create failed', err);
    }
  });

  loadAll(listEl);
}

document.addEventListener('DOMContentLoaded', init);
