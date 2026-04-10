/** Contract: contracts/app/rules.md */

/**
 * Folder picker dialog — lets the user select a destination folder
 * for moving a document (issues #285, #282).
 */

import { apiFetch } from '../shared/api-client.ts';

interface FolderEntry {
  id: string;
  name: string;
  parent_id: string | null;
}

/**
 * Show a modal dialog to pick a folder. Returns the selected folder ID,
 * null (move to root), or undefined if cancelled.
 */
export function showFolderPickerDialog(): Promise<string | null | undefined> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'name-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Move to folder');

    const titleEl = document.createElement('h2');
    titleEl.className = 'name-dialog-title';
    titleEl.textContent = 'Move to Folder';

    const list = document.createElement('div');
    list.className = 'folder-picker-list';
    list.textContent = 'Loading...';

    const actions = document.createElement('div');
    actions.className = 'name-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { cleanup(); resolve(undefined); });

    actions.appendChild(cancelBtn);
    dialog.append(titleEl, list, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { cleanup(); resolve(undefined); }
    });

    function cleanup(): void { overlay.remove(); }

    function pick(id: string | null): void {
      cleanup();
      resolve(id);
    }

    apiFetch('/api/folders')
      .then((res) => res.ok ? res.json() : [])
      .then((folders: FolderEntry[]) => {
        list.innerHTML = '';

        const rootRow = document.createElement('button');
        rootRow.className = 'folder-picker-row';
        rootRow.innerHTML = '<span class="ws-item-icon">🏠</span><span>Root (no folder)</span>';
        rootRow.addEventListener('click', () => pick(null));
        list.appendChild(rootRow);

        for (const folder of folders) {
          const row = document.createElement('button');
          row.className = 'folder-picker-row';
          const safeName = folder.name.replace(/</g, '&lt;');
          row.innerHTML = `<span class="ws-item-icon">📁</span><span>${safeName}</span>`;
          row.addEventListener('click', () => pick(folder.id));
          list.appendChild(row);
        }

        if (!folders.length) {
          const empty = document.createElement('p');
          empty.className = 'ws-empty';
          empty.textContent = 'No folders yet';
          list.appendChild(empty);
        }
      })
      .catch(() => { list.textContent = 'Failed to load folders'; });
  });
}
