/** Contract: contracts/app/rules.md */

/**
 * Name change modal — allows users to update their display name after
 * first-visit setup. Unlike the first-visit modal, this one IS dismissable.
 *
 * Returns the new name string, or null if cancelled.
 *
 * Issue #170: user identity in the UI.
 */

const LS_USER_NAME = 'opendesk:userName';
const LS_ANON_TOKEN = 'opendesk:anonToken';

/**
 * Shows a modal for changing the display name.
 * Saves to localStorage on confirm.
 * Returns the confirmed name, or null if cancelled.
 */
export function showNameChangeModal(currentName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'name-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'name-change-title');

    const modal = document.createElement('div');
    modal.className = 'name-dialog-modal';

    const title = document.createElement('h2');
    title.id = 'name-change-title';
    title.className = 'name-dialog-title';
    title.textContent = 'Change your display name';
    modal.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-dialog-input';
    input.value = currentName;
    input.placeholder = 'Your display name…';
    input.maxLength = 64;
    modal.appendChild(input);

    const errorMsg = document.createElement('p');
    errorMsg.className = 'name-setup-error';
    errorMsg.setAttribute('aria-live', 'polite');
    errorMsg.hidden = true;
    errorMsg.textContent = 'Please enter a name.';
    modal.appendChild(errorMsg);

    const actions = document.createElement('div');
    actions.className = 'name-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    actions.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save';
    actions.appendChild(saveBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => input.focus());

    function finish(value: string | null): void {
      overlay.remove();
      resolve(value);
    }

    function save(): void {
      const val = input.value.trim();
      if (!val) {
        errorMsg.hidden = false;
        input.focus();
        return;
      }
      errorMsg.hidden = true;
      try {
        localStorage.setItem(LS_USER_NAME, val);
        if (!localStorage.getItem(LS_ANON_TOKEN)) {
          localStorage.setItem(LS_ANON_TOKEN, crypto.randomUUID());
        }
      } catch {
        // localStorage unavailable
      }
      finish(val);
    }

    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', () => finish(null));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') finish(null);
    });
  });
}
