/** Contract: contracts/app/rules.md */

/**
 * Trigger the browser's native print dialog.
 * The print.css stylesheet handles hiding UI chrome and formatting for paper.
 */
export function printDocument(): void {
  window.print();
}

/**
 * Export as PDF by opening the print dialog.
 * Modern browsers (Chrome, Edge, Firefox) offer "Save as PDF" as a print
 * destination. This is the most reliable client-side PDF generation path.
 */
export function exportPdf(): void {
  window.print();
}
