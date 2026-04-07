/** Contract: contracts/app/rules.md */

/** WAI-ARIA toolbar pattern with roving tabindex. */
export function enableToolbarNavigation(
  toolbar: HTMLElement,
  returnFocusTo: () => HTMLElement | null,
): void {
  updateRovingTabindex(toolbar);

  toolbar.addEventListener('keydown', (e) => {
    const buttons = getButtons(toolbar);
    if (buttons.length === 0) return;
    const current = document.activeElement as HTMLElement;
    const idx = buttons.indexOf(current);
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        e.preventDefault();
        focusButton(buttons, idx < buttons.length - 1 ? idx + 1 : 0);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault();
        focusButton(buttons, idx > 0 ? idx - 1 : buttons.length - 1);
        break;
      }
      case 'Home': {
        e.preventDefault();
        focusButton(buttons, 0);
        break;
      }
      case 'End': {
        e.preventDefault();
        focusButton(buttons, buttons.length - 1);
        break;
      }
      case 'Escape': {
        e.preventDefault();
        returnFocusTo()?.focus();
        break;
      }
    }
  });
}

function getButtons(toolbar: HTMLElement): HTMLElement[] {
  return Array.from(toolbar.querySelectorAll<HTMLElement>('button:not([disabled])'));
}

function focusButton(buttons: HTMLElement[], index: number): void {
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].setAttribute('tabindex', i === index ? '0' : '-1');
  }
  buttons[index].focus();
}

/** Set initial roving tabindex: first button is 0, rest are -1. */
export function updateRovingTabindex(toolbar: HTMLElement): void {
  const buttons = getButtons(toolbar);
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].setAttribute('tabindex', i === 0 ? '0' : '-1');
  }
}
