/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import { getCellFormat } from './format/store.ts';
import { applyCellFormat, getDisplayValue } from './format/renderer.ts';
import { updateToolbarState } from './format/toolbar.ts';
import { evaluateCellValue } from './cell-evaluator.ts';
import type { SheetStore } from './sheet-store.ts';

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
  store: SheetStore;
  activeSheetId: string;
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

/** Move focus to the cell at (row, col) within the grid, clamped to bounds. */
function focusCell(gridEl: HTMLElement, row: number, col: number, cols: number, rows: number): void {
  const clampedRow = Math.max(0, Math.min(row, rows - 1));
  const clampedCol = Math.max(0, Math.min(col, cols - 1));
  const target = gridEl.querySelector<HTMLElement>(
    `[data-row="${clampedRow}"][data-col="${clampedCol}"]`,
  );
  target?.focus();
}

export function renderFormattedGrid(ctx: GridRenderContext): void {
  const { gridEl, ydoc, ysheet, cols, rows, cellRefEl, formulaInput, formatToolbar, store, activeSheetId, onCellFocus } = ctx;
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
      // Display evaluated value (resolves formulas); show raw in formula bar on focus
      const displayValue = rawValue.startsWith('=')
        ? evaluateCellValue(rawValue, store, activeSheetId)
        : getDisplayValue(rawValue, fmt);
      cell.textContent = displayValue;
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.dataset.rawValue = rawValue;

      applyCellFormat(cell, fmt);

      cell.addEventListener('focus', () => {
        onCellFocus(r, c);
        if (cellRefEl) cellRefEl.textContent = colLabel(c) + (r + 1);
        // Show raw formula/value in formula bar; show raw in cell while editing
        if (formulaInput) formulaInput.value = rawValue;
        cell.textContent = rawValue;
        if (formatToolbar) updateToolbarState(formatToolbar, getCellFormat(ydoc, r, c));
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
        // Restore display value after editing
        cell.textContent = val.startsWith('=')
          ? evaluateCellValue(val, store, activeSheetId)
          : getDisplayValue(val, getCellFormat(ydoc, r, c));
      });

      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          // Commit current cell value
          const val = cell.textContent || '';
          const currentRow = ysheet.get(r);
          if (currentRow && currentRow.get(c) !== val) {
            ydoc.transact(() => {
              currentRow.delete(c, 1);
              currentRow.insert(c, [val]);
            });
          }
          // Navigate: Tab → right, Shift+Tab → left, Enter → down, Shift+Enter → up
          if (e.key === 'Tab') {
            focusCell(gridEl, r, e.shiftKey ? c - 1 : c + 1, cols, rows);
          } else {
            focusCell(gridEl, e.shiftKey ? r - 1 : r + 1, c, cols, rows);
          }
        }
      });

      gridEl.appendChild(cell);
    }
  }
}
