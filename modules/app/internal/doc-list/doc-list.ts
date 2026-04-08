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
import { buildWorkspaceSidebar } from '../shared/workspace-sidebar.ts';
import { createGlobalSearch } from '../editor/global-search.ts';
import { renderDocuments, TYPE_META } from './doc-list-render.ts';

async function loadAll(listEl: HTMLElement) {
  const folderId = getCurrentFolderId();
  listEl.innerHTML = '';

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
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    const docs = Array.isArray(data) ? data : [];
    renderDocuments(listEl, docs, () => loadAll(listEl));
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

async function createTypedDocument(documentType: string): Promise<void> {
  const meta = TYPE_META[documentType] || TYPE_META.text;
  const titleText = prompt(`${meta.label} title:`);
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

function init() {
  initTheme();

  const sidebarSlot = document.getElementById('workspace-sidebar');
  if (sidebarSlot) sidebarSlot.replaceWith(buildWorkspaceSidebar());

  buildThemeToggle();
  buildNotificationBell();

  const listEl = document.getElementById('doc-list');
  const newBtn = document.getElementById('new-doc-btn');
  const toolbarRight = document.querySelector('.toolbar-right');
  if (!listEl || !newBtn) return;

  if (toolbarRight) createNewFolderButton(toolbarRight as HTMLElement);

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
      if (docId) window.location.href = '/editor.html?doc=' + encodeURIComponent(docId);
    } catch (err) { console.error('Create failed', err); }
  });

  document.getElementById('new-sheet-btn')
    ?.addEventListener('click', () => createTypedDocument('spreadsheet'));
  document.getElementById('new-slides-btn')
    ?.addEventListener('click', () => createTypedDocument('presentation'));

  loadAll(listEl);
}

document.addEventListener('DOMContentLoaded', init);
