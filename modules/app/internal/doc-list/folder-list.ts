/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import { showNameDialog } from './name-dialog.ts';
import { showDeleteConfirmDialog } from './delete-confirm-dialog.ts';
import { showToast } from '../shared/toast.ts';

interface FolderEntry {
  id: string;
  name: string;
  parent_id: string | null;
}

/** Breadcrumb path entry */
interface BreadcrumbItem {
  id: string | null;
  name: string;
}

/** State for current folder navigation */
let currentFolderId: string | null = null;
let breadcrumbs: BreadcrumbItem[] = [{ id: null, name: t('folders.root') }];
let onNavigate: ((folderId: string | null) => void) | null = null;

export function getCurrentFolderId(): string | null {
  return currentFolderId;
}

export function setNavigateCallback(cb: (folderId: string | null) => void): void {
  onNavigate = cb;
}

export function navigateToFolder(folderId: string | null, folderName?: string): void {
  if (folderId === null) {
    currentFolderId = null;
    breadcrumbs = [{ id: null, name: t('folders.root') }];
  } else {
    currentFolderId = folderId;
    const existingIdx = breadcrumbs.findIndex((b) => b.id === folderId);
    if (existingIdx >= 0) {
      breadcrumbs = breadcrumbs.slice(0, existingIdx + 1);
    } else {
      breadcrumbs.push({ id: folderId, name: folderName || '' });
    }
  }
  onNavigate?.(currentFolderId);
}

export function renderBreadcrumbs(container: HTMLElement): void {
  container.innerHTML = '';
  container.className = 'folder-breadcrumbs';
  container.setAttribute('aria-label', t('folders.breadcrumb'));

  for (let i = 0; i < breadcrumbs.length; i++) {
    const crumb = breadcrumbs[i];

    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = ' / ';
      container.appendChild(sep);
    }

    if (i < breadcrumbs.length - 1) {
      const link = document.createElement('button');
      link.className = 'breadcrumb-link';
      link.textContent = crumb.name;
      link.addEventListener('click', () => navigateToFolder(crumb.id, crumb.name));
      container.appendChild(link);
    } else {
      const current = document.createElement('span');
      current.className = 'breadcrumb-current';
      current.textContent = crumb.name;
      container.appendChild(current);
    }
  }
}

export function renderFolders(
  container: HTMLElement,
  folders: FolderEntry[],
): void {
  for (const folder of folders) {
    const row = document.createElement('div');
    row.className = 'folder-row';

    const nameGroup = document.createElement('button');
    nameGroup.className = 'folder-row-link';

    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = '\uD83D\uDCC1';

    const nameEl = document.createElement('span');
    nameEl.className = 'folder-row-name';
    nameEl.textContent = folder.name;

    nameGroup.appendChild(icon);
    nameGroup.appendChild(nameEl);
    nameGroup.addEventListener('click', () => {
      navigateToFolder(folder.id, folder.name);
    });

    const actions = createFolderActions(folder);

    row.appendChild(nameGroup);
    row.appendChild(actions);
    container.appendChild(row);
  }
}

function createFolderActions(folder: FolderEntry): HTMLElement {
  const group = document.createElement('div');
  group.className = 'folder-actions';

  const renameBtn = document.createElement('button');
  renameBtn.className = 'btn btn-small';
  renameBtn.textContent = t('folders.rename');
  renameBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const newName = await showNameDialog('folders.renamePrompt', folder.name);
    if (!newName || newName === folder.name) return;
    apiFetch('/api/folders/' + encodeURIComponent(folder.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Rename failed: ${res.status}`);
        onNavigate?.(currentFolderId);
      })
      .catch((err) => {
        console.error('[opendesk] folder rename error:', err);
        showToast(t('folders.renameFailed'));
      });
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-small btn-delete-folder';
  deleteBtn.textContent = t('folders.delete');
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!await showDeleteConfirmDialog(folder.name)) return;
    apiFetch('/api/folders/' + encodeURIComponent(folder.id), {
      method: 'DELETE',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
        onNavigate?.(currentFolderId);
      })
      .catch((err) => {
        console.error('[opendesk] folder delete error:', err);
        showToast(t('folders.deleteFailed'));
      });
  });

  group.appendChild(renameBtn);
  group.appendChild(deleteBtn);
  return group;
}

export async function loadFolders(parentId: string | null): Promise<FolderEntry[]> {
  const url = parentId
    ? '/api/folders?parentId=' + encodeURIComponent(parentId)
    : '/api/folders';
  const res = await apiFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function createNewFolderButton(container: HTMLElement): void {
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.id = 'new-folder-btn';
  btn.textContent = t('folders.new');
  btn.addEventListener('click', async () => {
    const name = await showNameDialog('folders.namePrompt');
    if (!name) return;
    apiFetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    }).then(() => onNavigate?.(currentFolderId));
  });
  container.appendChild(btn);
}
