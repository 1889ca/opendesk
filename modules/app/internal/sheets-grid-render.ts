/** Contract: contracts/app/rules.md */
import * as Y from 'yjs';
import { getCellFormat } from './sheets-format-store.ts';
import { applyCellFormat, getDisplayValue } from './sheets-format-renderer.ts';
import { updateToolbarState } from './sheets-format-toolbar.ts';

export function colLabel(index: number): string {
  let label = '';
  let i = index;
  while (i >= 0) {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  }
  return label;
}

export interface GridRenderContext {
  gridEl: HTMLElement;
  ydoc: Y.Doc;
  ysheet: Y.Array<Y.Array<string>>;
  cols: number;
  rows: number;
  cellRefEl: HTMLElement | null;
  formulaInput: HTMLInputElement | null;
  formatToolbar: HTMLElement | null;
  onCellFocus: (row: number, col: number) => void;
}

export function ensureGrid(ydoc: Y.Doc, ysheet: Y.Array<Y.Array<string>>, rows: number, cols: number): void {
  if (ysheet.length === 0) {
    ydoc.transact(() => {
      for (let r = 0; r < rows; r++) {
        const row = new Y.Array<string>();
        const cells: string[] = [];
        for (let c = 0; c < cols; c++) cells.push('');
        row.insert(0, cells);
        ysheet.insert(ysheet.length, [row]);
      }
    });
  }
}

export function renderFormattedGrid(ctx: GridRenderContext): void {
  const { gridEl, ydoc, ysheet, cols, rows, cellRefEl, formulaInput, formatToolbar, onCellFocus } = ctx;
  ensureGrid(ydoc, ysheet, rows, cols);
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `3rem repeat(${cols}, minmax(5rem, 1fr))`;

  const corner = document.createElement('div');
  corner.className = 'cell header';
  gridEl.appendChild(corner);

  for (let c = 0; c < cols; c++) {
    const hdr = document.createElement('div');
    hdr.className = 'cell header';
    hdr.textContent = colLabel(c);
    hdr.dataset.colHeader = String(c);
    gridEl.appendChild(hdr);
  }

  for (let r = 0; r < Math.min(ysheet.length, rows); r++) {
    const rh = document.createElement('div');
    rh.className = 'cell row-header';
    rh.textContent = String(r + 1);
    rh.dataset.rowHeader = String(r);
    gridEl.appendChild(rh);

    const yrow = ysheet.get(r);
    for (let c = 0; c < cols; c++) {
      const rawValue = (yrow && c < yrow.length) ? yrow.get(c) : '';
      const fmt = getCellFormat(ydoc, r, c);

      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.contentEditable = 'true';
      cell.textContent = getDisplayValue(rawValue, fmt);
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);

      applyCellFormat(cell, fmt);

      cell.addEventListener('focus', () => {
        onCellFocus(r, c);
        if (cellRefEl) cellRefEl.textContent = colLabel(c) + (r + 1);
        if (formulaInput) formulaInput.value = rawValue;
        if (formatToolbar) updateToolbarState(formatToolbar, getCellFormat(ydoc, r, c));
      });

      cell.addEventListener('blur', () => {
        const val = cell.textContent || '';
        const row = ysheet.get(r);
        if (row && row.get(c) !== val) {
          ydoc.transact(() => {
            row.delete(c, 1);
            row.insert(c, [val]);
          });
        }
      });

      gridEl.appendChild(cell);
    }
  }
}
