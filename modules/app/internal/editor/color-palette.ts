/** Contract: contracts/app/rules.md */
/**
 * color-palette — builds a floating color palette popup for text color selection.
 */
import { TEXT_COLORS } from './text-color.ts';

/** Move focus within swatches using arrow keys. Returns the new index or null if key not handled. */
function handleSwatchKeyNav(
  e: KeyboardEvent,
  swatches: NodeListOf<HTMLElement>,
  currentIndex: number,
  cols: number,
): number | null {
  const total = swatches.length;
  let next: number | null = null;

  if (e.key === 'ArrowRight') next = (currentIndex + 1) % total;
  else if (e.key === 'ArrowLeft') next = (currentIndex - 1 + total) % total;
  else if (e.key === 'ArrowDown') next = Math.min(currentIndex + cols, total - 1);
  else if (e.key === 'ArrowUp') next = Math.max(currentIndex - cols, 0);

  if (next !== null) {
    e.preventDefault();
    swatches[currentIndex].setAttribute('tabindex', '-1');
    swatches[next].setAttribute('tabindex', '0');
    swatches[next].focus();
  }

  return next;
}

/**
 * Build a color palette popup element.
 * The returned element is NOT yet attached to the DOM.
 * Clicking a swatch calls onChange with the color value and removes the popup.
 * Clicking outside the popup also removes it.
 * Arrow keys navigate between swatches; Enter/Space applies; Escape closes.
 */
export function buildColorPalette(onChange: (color: string) => void): HTMLElement {
  const COLS = 6;

  const popup = document.createElement('div');
  popup.className = 'color-palette-popup';
  popup.setAttribute('role', 'radiogroup');
  popup.setAttribute('aria-label', 'Text color');

  const close = (): void => {
    popup.remove();
    document.removeEventListener('click', outsideClick);
  };

  TEXT_COLORS.forEach(({ label, value }, index) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = value ? 'color-swatch' : 'color-swatch color-swatch--default';
    swatch.setAttribute('role', 'radio');
    swatch.setAttribute('aria-label', label);
    swatch.setAttribute('title', label);
    swatch.setAttribute('tabindex', index === 0 ? '0' : '-1');

    if (value) {
      swatch.style.background = value;
    } else {
      swatch.textContent = '\u2298';
    }

    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      onChange(value);
      close();
    });

    swatch.addEventListener('keydown', (e) => {
      const swatches = popup.querySelectorAll<HTMLElement>('.color-swatch');
      const current = Array.from(swatches).indexOf(swatch);

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange(value);
        close();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      handleSwatchKeyNav(e, swatches, current, COLS);
    });

    popup.appendChild(swatch);
  });

  // Close when clicking outside
  const outsideClick = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node)) {
      close();
    }
  };

  // Defer so the click that opened the popup doesn't immediately close it
  setTimeout(() => {
    document.addEventListener('click', outsideClick);
  }, 0);

  return popup;
}
