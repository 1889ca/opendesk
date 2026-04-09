/** Contract: contracts/app/rules.md */
/**
 * highlight-palette — builds a floating highlight color palette popup.
 */
import { HIGHLIGHT_COLORS } from './text-highlight.ts';

/**
 * Build a highlight palette popup element.
 * The returned element is NOT yet attached to the DOM.
 * Clicking a swatch calls onChange with the color value and removes the popup.
 * Clicking outside the popup also removes it.
 */
export function buildHighlightPalette(onChange: (color: string) => void): HTMLElement {
  const popup = document.createElement('div');
  popup.className = 'color-palette-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Highlight color');

  for (const { label, value } of HIGHLIGHT_COLORS) {
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

  const outsideClick = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node)) {
      popup.remove();
      document.removeEventListener('click', outsideClick);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', outsideClick);
  }, 0);

  return popup;
}
