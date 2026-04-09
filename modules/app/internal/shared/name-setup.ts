/** Contract: contracts/app/rules.md */

/**
 * First-visit name setup modal.
 *
 * Shows a non-dismissable dialog asking the user for a display name.
 * On first visit (opendesk:userNameConfirmed not set), the modal blocks
 * until the user enters a name. After confirmation, the name is saved to
 * localStorage and the auth token is rebuilt.
 *
 * Issue #170: wire anonymous identity into the auth token.
 */

const LS_USER_NAME = 'opendesk:userName';
const LS_NAME_CONFIRMED = 'opendesk:userNameConfirmed';
const LS_ANON_TOKEN = 'opendesk:anonToken';

/**
 * Returns true if the user has already confirmed a display name.
 */
export function isNameConfirmed(): boolean {
  try {
    return localStorage.getItem(LS_NAME_CONFIRMED) === '1';
  } catch {
    return true; // localStorage unavailable — skip prompt
  }
}

/**
 * Prompt for a display name if the user hasn't confirmed one yet.
 * Resolves when the user confirms. Non-dismissable.
 */
export function ensureNameConfirmed(): Promise<void> {
  if (isNameConfirmed()) return Promise.resolve();
  return showNameSetupModal();
}

function showNameSetupModal(): Promise<void> {
  return new Promise((resolve) => {
    let currentName = '';
    try {
      currentName = localStorage.getItem(LS_USER_NAME) ?? '';
    } catch {
      // ignore
    }

    const overlay = document.createElement('div');
    overlay.className = 'name-setup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'name-setup-title');

    const modal = document.createElement('div');
    modal.className = 'name-dialog-modal';

    const title = document.createElement('h2');
    title.id = 'name-setup-title';
    title.className = 'name-dialog-title';
    title.textContent = 'What should we call you?';
    modal.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'name-setup-subtitle';
    subtitle.textContent = 'This name is shown to collaborators when you edit documents.';
    modal.appendChild(subtitle);

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

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'btn btn-primary';
    continueBtn.textContent = 'Continue';
    actions.appendChild(continueBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => input.focus());

    function confirm(): void {
      const val = input.value.trim();
      if (!val) {
        errorMsg.hidden = false;
        input.focus();
        return;
      }
      errorMsg.hidden = true;
      try {
        localStorage.setItem(LS_USER_NAME, val);
        localStorage.setItem(LS_NAME_CONFIRMED, '1');
        // Ensure stable ID exists
        if (!localStorage.getItem(LS_ANON_TOKEN)) {
          localStorage.setItem(LS_ANON_TOKEN, crypto.randomUUID());
        }
      } catch {
        // localStorage unavailable — continue anyway
      }
      overlay.remove();
      resolve();
    }

    continueBtn.addEventListener('click', confirm);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirm();
    });

    // Intentionally NO: overlay click-to-dismiss, Escape key, cancel button.
    // The user must set a name.
  });
}
