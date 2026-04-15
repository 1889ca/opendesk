/** Contract: contracts/app/rules.md */

/**
 * In-page modal for creating a new KB entry.
 * Replaces window.prompt() (issue #346/#392).
 */

/** Show an in-page modal for creating a new KB entry. Calls onConfirm with the title. */
export function showNewEntryModal(onConfirm: (title: string) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'kb-new-entry-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'kb-new-entry-title');

  const modal = document.createElement('div');
  modal.className = 'kb-new-entry-modal';

  const heading = document.createElement('h2');
  heading.id = 'kb-new-entry-title';
  heading.className = 'kb-new-entry-modal__title';
  heading.textContent = 'New Entry';

  const label = document.createElement('label');
  label.htmlFor = 'kb-new-entry-input';
  label.textContent = 'Entry title:';
  label.className = 'kb-new-entry-modal__label';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'kb-new-entry-input';
  input.className = 'kb-new-entry-modal__input';
  input.placeholder = 'Enter a title\u2026';

  const actions = document.createElement('div');
  actions.className = 'kb-new-entry-modal__actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.className = 'btn btn-primary';
  createBtn.textContent = 'Create';

  actions.appendChild(cancelBtn);
  actions.appendChild(createBtn);

  modal.appendChild(heading);
  modal.appendChild(label);
  modal.appendChild(input);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => input.focus());

  function close(): void {
    overlay.remove();
  }

  function submit(): void {
    const title = input.value.trim();
    if (!title) return;
    close();
    onConfirm(title);
  }

  cancelBtn.addEventListener('click', close);
  createBtn.addEventListener('click', submit);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') close();
  });
}
