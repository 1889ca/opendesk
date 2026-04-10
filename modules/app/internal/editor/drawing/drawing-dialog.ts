/** Contract: contracts/app/rules.md */
/**
 * DrawingDialog — modal wrapper around the drawing canvas.
 * Opens full-screen overlay; resolves with an SVG string or null on cancel.
 */

import { createDrawingCanvas } from './drawing-canvas.ts';

/**
 * Open the drawing dialog.
 * @param initialSvg  Existing SVG markup if editing; omit for a new drawing.
 * @returns SVG string on save, or null on cancel.
 */
export function openDrawingDialog(initialSvg?: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'drawing-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Drawing editor');

    const dialog = document.createElement('div');
    dialog.className = 'drawing-dialog';

    const title = document.createElement('h2');
    title.className = 'drawing-dialog-title';
    title.textContent = 'Insert Drawing';
    dialog.appendChild(title);

    const { root, destroy } = createDrawingCanvas({ initialSvg });
    dialog.appendChild(root);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus trap: bring focus into the dialog
    const firstFocusable = dialog.querySelector<HTMLElement>(
      'button, input, select, textarea',
    );
    firstFocusable?.focus();

    function close(result: string | null): void {
      destroy();
      overlay.remove();
      resolve(result);
    }

    overlay.addEventListener('drawing:save', (e: Event) => {
      const detail = (e as CustomEvent<{ svg: string }>).detail;
      close(detail.svg);
    });

    overlay.addEventListener('drawing:cancel', () => close(null));

    // Click outside dialog closes (cancel)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    // Escape closes
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKeyDown);
        close(null);
      }
    }
    document.addEventListener('keydown', onKeyDown);
  });
}
