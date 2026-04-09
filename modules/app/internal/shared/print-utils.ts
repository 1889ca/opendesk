/** Contract: contracts/app/rules.md */

/**
 * Trigger the browser's native print dialog.
 * The print.css stylesheet handles hiding UI chrome and formatting for paper.
 */
export function printDocument(): void {
  window.print();
}

/**
 * Export as PDF by opening the browser's print dialog.
 * Modern browsers (Chrome, Edge, Firefox) offer "Save as PDF" as a print
 * destination. This is the most reliable client-side PDF generation path.
 *
 * Accepts an optional trigger button to show loading state while the dialog
 * is open, so the user gets clear feedback that something is happening.
 */
export function exportPdf(triggerBtn?: HTMLButtonElement): void {
  if (triggerBtn) {
    const original = triggerBtn.textContent ?? 'PDF';
    triggerBtn.disabled = true;
    triggerBtn.textContent = 'Preparing…';
    // window.print() is synchronous — it blocks until the dialog is dismissed.
    try {
      window.print();
    } finally {
      triggerBtn.disabled = false;
      triggerBtn.textContent = original;
    }
  } else {
    window.print();
  }
}
