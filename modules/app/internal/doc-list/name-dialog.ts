/** Contract: contracts/app/rules.md */

import { t } from '../i18n/index.ts';

/**
 * Show an inline modal asking the user for a document name.
 * Returns the entered name, or null if the user cancelled.
 */
export function showNameDialog(labelKey: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'name-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'name-dialog-title');

    const modal = document.createElement('div');
    modal.className = 'name-dialog-modal';

    const title = document.createElement('h2');
    title.id = 'name-dialog-title';
    title.className = 'name-dialog-title';
    title.textContent = t(labelKey as Parameters<typeof t>[0]);
    modal.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-dialog-input';
    input.value = defaultValue;
    input.placeholder = t('docList.namePlaceholder');
    modal.appendChild(input);

    const actions = document.createElement('div');
    actions.className = 'name-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = t('docList.nameCancel');
    actions.appendChild(cancelBtn);

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'btn btn-primary';
    createBtn.textContent = t('docList.nameCreate');
    actions.appendChild(createBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus the input after mount
    requestAnimationFrame(() => input.focus());

    function finish(value: string | null) {
      overlay.remove();
      resolve(value);
    }

    createBtn.addEventListener('click', () => {
      const val = input.value.trim();
      if (val) finish(val);
    });

    cancelBtn.addEventListener('click', () => finish(null));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value.trim();
        if (val) finish(val);
      }
      if (e.key === 'Escape') finish(null);
    });
  });
}
