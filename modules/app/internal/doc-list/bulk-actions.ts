/** Contract: contracts/app/rules.md */

/**
 * Bulk action bar for the document list (issue #173).
 * Shows when one or more document rows are checked, offering bulk delete.
 */

import { apiFetch } from '../shared/api-client.ts';
import { showDeleteConfirmDialog } from './delete-confirm-dialog.ts';

export interface BulkActionBar {
  el: HTMLElement;
  update: (selectedIds: Set<string>) => void;
  destroy: () => void;
}

/**
 * Creates and returns a bulk action bar element.
 * @param onComplete - Called after a successful bulk operation (e.g. to reload the list).
 */
export function createBulkActionBar(onComplete: () => void): BulkActionBar {
  const bar = document.createElement('div');
  bar.className = 'bulk-action-bar';
  bar.setAttribute('aria-live', 'polite');
  bar.hidden = true;

  const countEl = document.createElement('span');
  countEl.className = 'bulk-action-count';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger bulk-delete-btn';
  deleteBtn.textContent = 'Delete selected';

  bar.append(countEl, deleteBtn);

  let currentIds: Set<string> = new Set();

  function update(selectedIds: Set<string>): void {
    currentIds = selectedIds;
    const n = selectedIds.size;
    bar.hidden = n === 0;
    countEl.textContent = n === 1 ? '1 selected —' : `${n} selected —`;
  }

  deleteBtn.addEventListener('click', async () => {
    const n = currentIds.size;
    if (n === 0) return;
    const label = n === 1 ? '1 document' : `${n} documents`;
    const confirmed = await showDeleteConfirmDialog(label);
    if (!confirmed) return;

    const ids = Array.from(currentIds);
    await Promise.all(
      ids.map((id) =>
        apiFetch('/api/documents/' + encodeURIComponent(id), { method: 'DELETE' }).catch((err) => {
          console.error('Bulk delete failed for', id, err);
        }),
      ),
    );
    onComplete();
  });

  return {
    el: bar,
    update,
    destroy() {
      bar.remove();
    },
  };
}
