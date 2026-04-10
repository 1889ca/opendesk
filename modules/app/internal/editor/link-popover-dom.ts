/** Contract: contracts/app/rules.md */
/**
 * DOM-building helpers for the link popover.
 * Extracted from link-popover.ts to keep each file under 200 lines.
 */

export interface InsertViewCallbacks {
  onApply: (url: string) => void;
  onCancel: () => void;
}

export interface ViewModeCallbacks {
  onEdit: () => void;
  onCopy: (url: string) => void;
  onRemove: () => void;
}

/**
 * Build the insert/edit sub-view: URL input + Apply button.
 * Returns the container element and the input (for auto-focus).
 */
export function buildInsertView(
  initialValue: string,
  cb: InsertViewCallbacks,
): { container: HTMLElement; input: HTMLInputElement } {
  const container = document.createElement('div');
  container.className = 'link-popover-insert';

  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'link-popover-input';
  input.placeholder = 'https://...';
  input.value = initialValue;

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'link-popover-submit';
  submitBtn.textContent = 'Apply';

  submitBtn.addEventListener('mousedown', (e) => { e.preventDefault(); cb.onApply(input.value.trim()); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); cb.onApply(input.value.trim()); }
    else if (e.key === 'Escape') { e.preventDefault(); cb.onCancel(); }
  });

  container.appendChild(input);
  container.appendChild(submitBtn);
  return { container, input };
}

/**
 * Build the view-mode sub-view: URL display + Edit / Copy / Remove buttons.
 * Tab order is Edit → Copy → Remove (natural DOM order).
 */
export function buildViewMode(href: string, cb: ViewModeCallbacks): HTMLElement {
  const container = document.createElement('div');
  container.className = 'link-popover-view';

  const urlDisplay = document.createElement('span');
  urlDisplay.className = 'link-popover-url';
  urlDisplay.title = href;
  urlDisplay.textContent = href.length > 40 ? `${href.slice(0, 37)}\u2026` : href;

  const actions = document.createElement('div');
  actions.className = 'link-popover-actions';

  const editBtn = makeActionBtn('Edit', 'Edit link', () => cb.onEdit());
  const copyBtn = makeActionBtn('Copy', 'Copy link URL', () => cb.onCopy(href));
  const removeBtn = makeActionBtn('Remove', 'Remove link', () => cb.onRemove());
  removeBtn.classList.add('link-popover-action--remove');

  actions.appendChild(editBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(removeBtn);
  container.appendChild(urlDisplay);
  container.appendChild(actions);
  return container;
}

function makeActionBtn(label: string, ariaLabel: string, handler: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'link-popover-action';
  btn.textContent = label;
  btn.setAttribute('aria-label', ariaLabel);
  btn.addEventListener('mousedown', (e) => { e.preventDefault(); handler(); });
  return btn;
}
