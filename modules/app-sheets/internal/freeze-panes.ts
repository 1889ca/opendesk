/** Contract: contracts/app-sheets/rules.md */

import type { SheetStore } from './sheet-store.ts';
import { createHeaderContextMenu, type ContextMenuCallbacks, type HeaderContextMenu } from './header-context-menu.ts';
import { insertRow, deleteRow, insertColumn, deleteColumn } from './col-row-ops.ts';
import { buildCellMenuCallbacks } from './cell-menu-ops.ts';
import { sortByColumn } from './sort-engine.ts';
import * as Y from 'yjs';

export interface ContextMenuDeps {
  gridEl: HTMLElement;
  ydoc: Y.Doc;
  store: SheetStore;
  getActiveSheetId: () => string;
  getActiveSheet: () => Y.Array<Y.Array<string>>;
  doRender: () => void;
  doSort: (col: number, direction: 'asc' | 'desc') => void;
}

export function buildContextMenu(deps: ContextMenuDeps): HeaderContextMenu {
  const { gridEl, ydoc, store, getActiveSheetId, getActiveSheet, doRender, doSort } = deps;

  const cellMenu = buildCellMenuCallbacks(ydoc, getActiveSheetId, getActiveSheet, doRender);

  const callbacks: ContextMenuCallbacks = {
    insertRowAbove(row) { insertRow(ydoc, getActiveSheetId(), row); },
    insertRowBelow(row) { insertRow(ydoc, getActiveSheetId(), row); },
    deleteRow(row) { deleteRow(ydoc, getActiveSheetId(), row); },
    insertColumnLeft(col) { insertColumn(ydoc, getActiveSheetId(), col); },
    insertColumnRight(col) { insertColumn(ydoc, getActiveSheetId(), col); },
    deleteColumn(col) { deleteColumn(ydoc, getActiveSheetId(), col); },
    sortColumn(col, direction) { doSort(col, direction); },
    cellMenu,
    freezeRowsAbove(row) { store.setFrozenRows(getActiveSheetId(), row); doRender(); },
    unfreezeRows() { store.setFrozenRows(getActiveSheetId(), 0); doRender(); },
    freezeColsLeft(col) { store.setFrozenCols(getActiveSheetId(), col); doRender(); },
    unfreezeCols() { store.setFrozenCols(getActiveSheetId(), 0); doRender(); },
  };

  return createHeaderContextMenu(gridEl, callbacks);
}
