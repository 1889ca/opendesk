/** Contract: contracts/app/rules.md */
import { t } from '../i18n/index.ts';

/**
 * Prompt the user to optionally name a version.
 * Returns the entered string (possibly empty), or null if the user cancelled.
 * Unlike the generic showNameDialog, an empty value is valid here (means no name).
 */
export function promptVersionName(): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'name-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'name-dialog-modal';

    const titleEl = document.createElement('h2');
    titleEl.className = 'name-dialog-title';
    titleEl.textContent = t('versions.namePrompt');
    modal.appendChild(titleEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-dialog-input';
    input.placeholder = t('versions.namePlaceholder');
    modal.appendChild(input);

    const actions = document.createElement('div');
    actions.className = 'name-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = t('docList.nameCancel');
    actions.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = t('versions.save');
    actions.appendChild(saveBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => input.focus());

    function finish(value: string | null) {
      overlay.remove();
      resolve(value);
    }

    saveBtn.addEventListener('click', () => finish(input.value.trim()));
    cancelBtn.addEventListener('click', () => finish(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(input.value.trim());
      if (e.key === 'Escape') finish(null);
    });
  });
}
