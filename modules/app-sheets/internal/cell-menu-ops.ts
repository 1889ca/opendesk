/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import type { CellContextMenuCallbacks } from './header-context-menu.ts';
import { insertRow, deleteRow } from './col-row-ops.ts';

export interface CellMenuOps extends CellContextMenuCallbacks {
  readonly clipboard: { value: string | null };
}

/**
 * Build the cell-level context menu callbacks for a given sheet.
 * Handles Cut / Copy / Paste / Clear / Insert row / Delete row.
 */
export function buildCellMenuCallbacks(
  ydoc: Y.Doc,
  getActiveSheetId: () => string,
  getActiveSheet: () => Y.Array<Y.Array<string>>,
  doRender: () => void,
): CellMenuOps {
  const clipboard = { value: null as string | null };

  return {
    clipboard,

    cutCell(row: number, col: number): void {
      const yrow = getActiveSheet().get(row);
      if (!yrow) return;
      clipboard.value = yrow.get(col) || '';
      ydoc.transact(() => { yrow.delete(col, 1); yrow.insert(col, ['']); });
      doRender();
    },

    copyCell(row: number, col: number): void {
      const yrow = getActiveSheet().get(row);
      clipboard.value = (yrow && yrow.get(col)) || '';
      navigator.clipboard?.writeText(clipboard.value).catch(() => undefined);
    },

    pasteCell(row: number, col: number): void {
      if (clipboard.value == null) return;
      const yrow = getActiveSheet().get(row);
      if (!yrow) return;
      const val = clipboard.value;
      ydoc.transact(() => { yrow.delete(col, 1); yrow.insert(col, [val]); });
      doRender();
    },

    clearCell(row: number, col: number): void {
      const yrow = getActiveSheet().get(row);
      if (!yrow) return;
      ydoc.transact(() => { yrow.delete(col, 1); yrow.insert(col, ['']); });
      doRender();
    },

    insertRowAboveCell(row: number): void {
      insertRow(ydoc, getActiveSheetId(), row);
    },

    insertRowBelowCell(row: number): void {
      insertRow(ydoc, getActiveSheetId(), row + 1);
    },

    deleteRowAtCell(row: number): void {
      deleteRow(ydoc, getActiveSheetId(), row);
    },
  };
}
