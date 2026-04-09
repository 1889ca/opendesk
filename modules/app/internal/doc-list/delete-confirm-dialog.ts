/** Contract: contracts/app/rules.md */

import { t } from '../i18n/index.ts';

/**
 * Show a confirmation modal before permanently deleting a document (issue #163).
 * Uses a CSS overlay (not window.confirm) for consistency with #157.
 * Returns true if the user confirmed, false if they cancelled.
 */
export function showDeleteConfirmDialog(docName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'delete-confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'delete-confirm-title');

    const modal = document.createElement('div');
    modal.className = 'delete-confirm-modal';

    const title = document.createElement('h2');
    title.id = 'delete-confirm-title';
    title.className = 'delete-confirm-title';
    title.textContent = t('docList.deleteConfirm', { name: docName });
    modal.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'delete-confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = t('docList.nameCancel');
    actions.appendChild(cancelBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = t('docList.delete');
    actions.appendChild(deleteBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => deleteBtn.focus());

    function finish(confirmed: boolean) {
      overlay.remove();
      resolve(confirmed);
    }

    deleteBtn.addEventListener('click', () => finish(true));
    cancelBtn.addEventListener('click', () => finish(false));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') finish(false);
    });
  });
}
