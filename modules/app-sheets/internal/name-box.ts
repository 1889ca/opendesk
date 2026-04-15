/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import { defineNamedRange, resolveNamedRange, isValidName } from './named-ranges.ts';
import { parseCellRef, parseRangeRef } from './cross-sheet-ref.ts';
import { colLabel } from './grid-render.ts';

export interface NameBoxDeps {
  ydoc: Y.Doc;
  element: HTMLInputElement;
  getActiveSheetId: () => string;
  getSelectedRange: () => { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  navigateTo: (row: number, col: number) => void;
  getCurrentCell: () => { row: number; col: number };
}

export interface NameBox {
  update(row: number, col: number): void;
  destroy(): void;
}

function cellAddress(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`;
}

function rangeAddress(
  startRow: number, startCol: number, endRow: number, endCol: number,
): string {
  if (startRow === endRow && startCol === endCol) {
    return cellAddress(startRow, startCol);
  }
  return `${cellAddress(startRow, startCol)}:${cellAddress(endRow, endCol)}`;
}

/** Create the Name Box — the input left of the formula bar. */
export function createNameBox(deps: NameBoxDeps): NameBox {
  const { ydoc, element, getActiveSheetId, getSelectedRange, navigateTo } = deps;

  let isEditing = false;

  function commit(): void {
    const val = element.value.trim();
    if (!val) {
      // Restore current cell address
      const { row, col } = deps.getCurrentCell();
      element.value = cellAddress(row, col);
      return;
    }

    // Check if it matches a named range — navigate to it
    const resolved = resolveNamedRange(ydoc, val);
    if (resolved) {
      const cellRef = parseCellRef(resolved.range);
      if (cellRef) {
        navigateTo(cellRef.row, cellRef.col);
        element.blur();
        return;
      }
      const rangeRef = parseRangeRef(resolved.range);
      if (rangeRef) {
        navigateTo(rangeRef.startRow, rangeRef.startCol);
        element.blur();
        return;
      }
    }

    // Check if it's a raw cell address — navigate to it
    const cellRef = parseCellRef(val);
    if (cellRef) {
      navigateTo(cellRef.row, cellRef.col);
      element.blur();
      return;
    }

    // Check if it looks like a range ref — navigate to start
    const rangeRef = parseRangeRef(val);
    if (rangeRef) {
      navigateTo(rangeRef.startRow, rangeRef.startCol);
      element.blur();
      return;
    }

    // It's a valid name — define it as a named range over the current selection
    if (isValidName(val)) {
      const sheetId = getActiveSheetId();
      const sel = getSelectedRange();
      const rangeStr = sel
        ? rangeAddress(sel.startRow, sel.startCol, sel.endRow, sel.endCol)
        : cellAddress(deps.getCurrentCell().row, deps.getCurrentCell().col);
      defineNamedRange(ydoc, { name: val, sheetId, range: rangeStr });
      element.blur();
      return;
    }

    // Unknown — restore
    const { row, col } = deps.getCurrentCell();
    element.value = cellAddress(row, col);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      const { row, col } = deps.getCurrentCell();
      element.value = cellAddress(row, col);
      element.blur();
    }
  }

  function onFocus(): void {
    isEditing = true;
    element.select();
  }

  function onBlur(): void {
    isEditing = false;
  }

  element.addEventListener('keydown', onKeyDown);
  element.addEventListener('focus', onFocus);
  element.addEventListener('blur', onBlur);

  return {
    update(row: number, col: number): void {
      if (!isEditing) {
        element.value = cellAddress(row, col);
      }
    },
    destroy(): void {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('focus', onFocus);
      element.removeEventListener('blur', onBlur);
    },
  };
}
