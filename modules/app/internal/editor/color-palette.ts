/** Contract: contracts/app/rules.md */
/**
 * color-palette — builds a floating color palette popup for text color selection.
 */
import { TEXT_COLORS } from './text-color.ts';

/**
 * Build a color palette popup element.
 * The returned element is NOT yet attached to the DOM.
 * Clicking a swatch calls onChange with the color value and removes the popup.
 * Clicking outside the popup also removes it.
 */
export function buildColorPalette(onChange: (color: string) => void): HTMLElement {
  const popup = document.createElement('div');
  popup.className = 'color-palette-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Text color');

  for (const { label, value } of TEXT_COLORS) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = value ? 'color-swatch' : 'color-swatch color-swatch--default';
    swatch.setAttribute('aria-label', label);
    swatch.setAttribute('title', label);

    if (value) {
      swatch.style.background = value;
    } else {
      swatch.textContent = '\u2298';
    }

    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      onChange(value);
      popup.remove();
      document.removeEventListener('click', outsideClick);
    });

    popup.appendChild(swatch);
  }

  // Close when clicking outside
  const outsideClick = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node)) {
      popup.remove();
      document.removeEventListener('click', outsideClick);
    }
  };

  // Defer so the click that opened the popup doesn't immediately close it
  setTimeout(() => {
    document.addEventListener('click', outsideClick);
  }, 0);

  return popup;
}
