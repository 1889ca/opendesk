/** Contract: contracts/sheets-tabs/rules.md */
import * as Y from 'yjs';
import type { SheetStore } from './sheet-store.ts';
import { evaluateCellValue } from './cell-evaluator.ts';

export interface GridRenderOptions {
  gridEl: HTMLElement;
  ysheet: Y.Array<Y.Array<string>>;
  ydoc: Y.Doc;
  cols: number;
  rows: number;
  activeRow: number;
  activeCol: number;
  cellRefEl: HTMLElement | null;
  formulaInput: HTMLInputElement | null;
  store: SheetStore;
  activeSheetId: string;
  onCellFocus: (row: number, col: number) => void;
}

function colLabel(index: number): string {
  let label = '';
  let i = index;
  while (i >= 0) {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  }
  return label;
}

function ensureGrid(ysheet: Y.Array<Y.Array<string>>, ydoc: Y.Doc, rows: number, cols: number) {
  if (ysheet.length === 0) {
    ydoc.transact(() => {
      for (let r = 0; r < rows; r++) {
        const row = new Y.Array<string>();
        const cells: string[] = new Array(cols).fill('');
        row.insert(0, cells);
        ysheet.insert(ysheet.length, [row]);
      }
    });
  }
}

/** Render the spreadsheet grid for the active sheet. */
export function renderGrid(opts: GridRenderOptions): void {
  const { gridEl, ysheet, ydoc, cols, rows, cellRefEl, formulaInput, store, activeSheetId } = opts;

  ensureGrid(ysheet, ydoc, rows, cols);
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `3rem repeat(${cols}, minmax(5rem, 1fr))`;

  // Corner cell
  const corner = document.createElement('div');
  corner.className = 'cell header';
  gridEl.appendChild(corner);

  // Column headers
  for (let c = 0; c < cols; c++) {
    const hdr = document.createElement('div');
    hdr.className = 'cell header';
    hdr.textContent = colLabel(c);
    gridEl.appendChild(hdr);
  }

  // Rows
  for (let r = 0; r < Math.min(ysheet.length, rows); r++) {
    const rh = document.createElement('div');
    rh.className = 'cell row-header';
    rh.textContent = String(r + 1);
    gridEl.appendChild(rh);

    const yrow = ysheet.get(r);
    for (let c = 0; c < cols; c++) {
      const rawValue = (yrow && c < yrow.length) ? yrow.get(c) : '';
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.contentEditable = 'true';
      cell.textContent = evaluateCellValue(rawValue, store, activeSheetId);
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);

      cell.addEventListener('focus', () => {
        opts.onCellFocus(r, c);
        if (cellRefEl) cellRefEl.textContent = colLabel(c) + (r + 1);
        // Show raw value (formula) in formula bar, display value in cell
        if (formulaInput) formulaInput.value = rawValue;
      });

      cell.addEventListener('blur', () => {
        const val = cell.textContent || '';
        const currentRow = ysheet.get(r);
        if (currentRow && currentRow.get(c) !== val) {
          ydoc.transact(() => {
            currentRow.delete(c, 1);
            currentRow.insert(c, [val]);
          });
        }
      });

      gridEl.appendChild(cell);
    }
  }
}
