/** Contract: contracts/app/rules.md */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getUserIdentity, getDocumentId } from './shared/identity.ts';
import { setupTitleSync } from './shared/title-sync.ts';
import { createFormatToolbar } from './sheets-format-toolbar.ts';
import { getFormatMap } from './sheets-format-store.ts';
import { attachFormatShortcuts } from './sheets-format-shortcuts.ts';
import { renderFormattedGrid } from './sheets-grid-render.ts';
import { SheetStore } from './sheets/sheet-store.ts';
import { TabBar } from './sheets/tab-bar.ts';
import { createRangeSelection } from './sheets/range-selection.ts';
import { createClipboardManager } from './sheets/clipboard.ts';
import { createColRowResize } from './sheets/col-row-resize.ts';
import { createHeaderContextMenu } from './sheets/header-context-menu.ts';
import { insertRow, deleteRow, insertColumn, deleteColumn } from './sheets/col-row-ops.ts';
import { sortByColumn } from './sheets/sort-engine.ts';
import { createFilterManager } from './sheets/filter-manager.ts';
import { getRules, addRule, observeRules } from './sheets/cond-format-rules.ts';
import { applyCondFormatting } from './sheets/cond-format-renderer.ts';
import { openCondFormatDialog } from './sheets/cond-format-dialog.ts';
import { setupPresence } from './sheets/presence.ts';

const DEFAULT_COLS = 26;
const DEFAULT_ROWS = 50;

function setupFormulaBar(
  input: HTMLInputElement, ydoc: Y.Doc,
  getSheet: () => Y.Array<Y.Array<string>>, getRow: () => number, getCol: () => number, render: () => void,
): void {
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const yrow = getSheet().get(getRow());
    if (yrow) ydoc.transact(() => { yrow.delete(getCol(), 1); yrow.insert(getCol(), [input.value]); });
    render();
  });
}

function appendCondFormatButton(container: HTMLElement, ydoc: Y.Doc, getCol: () => number): void {
  const btn = document.createElement('button');
  btn.className = 'format-btn';
  btn.textContent = 'Cond Format';
  btn.title = 'Conditional Formatting';
  btn.addEventListener('click', () => openCondFormatDialog((rule) => addRule(ydoc, rule), getCol()));
  container.appendChild(btn);
}

function init() {
  const gridEl = document.getElementById('spreadsheet')!;
  const statusEl = document.getElementById('status');
  const usersEl = document.getElementById('users');
  const cellRefEl = document.getElementById('cell-ref');
  const formulaInput = document.getElementById('formula-input') as HTMLInputElement | null;
  const formatBarContainer = document.getElementById('format-bar-container');
  const tabContainer = document.getElementById('sheet-tab-container');
  if (!gridEl) return;

  const documentId = getDocumentId();
  setupTitleSync(documentId, 'OpenDesk Spreadsheet');
  const user = getUserIdentity();
  const ydoc = new Y.Doc();

  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const provider = new HocuspocusProvider({
    url: `${wsProto}//${location.host}/collab`, name: documentId, document: ydoc,
    onConnect() { if (statusEl) { statusEl.textContent = 'Connected'; statusEl.className = 'status connected'; } },
    onDisconnect() { if (statusEl) { statusEl.textContent = 'Disconnected'; statusEl.className = 'status disconnected'; } },
  });

  const store = new SheetStore(ydoc);
  let activeSheetId = store.getSheets()[0]?.id || 'sheet-0';
  let activeRow = 0;
  let activeCol = 0;

  function getActiveSheet(): Y.Array<Y.Array<string>> {
    return store.getSheetData(activeSheetId);
  }

  const fmtCb = { getActiveCell: () => ({ row: activeRow, col: activeCol }), onFormatChanged: () => doRender() };
  let formatToolbar: HTMLElement | null = null;
  if (formatBarContainer) {
    formatToolbar = createFormatToolbar(formatBarContainer, ydoc, fmtCb);
    appendCondFormatButton(formatBarContainer, ydoc, () => activeCol);
  }
  attachFormatShortcuts(ydoc, fmtCb);

  const rangeSelection = createRangeSelection(gridEl);
  const clipboardMgr = createClipboardManager(gridEl, rangeSelection, store, { ydoc, ysheet: () => getActiveSheet() });
  const resizeMgr = createColRowResize(gridEl, ydoc);

  // --- Sort helper ---
  function doSort(col: number, direction: 'asc' | 'desc'): void {
    sortByColumn(ydoc, getActiveSheet(), col, direction);
    doRender();
  }

  // --- Context Menu ---
  const ctxMenu = createHeaderContextMenu(gridEl, {
    insertRowAbove(row) { insertRow(ydoc, activeSheetId, row); },
    insertRowBelow(row) { insertRow(ydoc, activeSheetId, row); },
    deleteRow(row) { deleteRow(ydoc, activeSheetId, row); },
    insertColumnLeft(col) { insertColumn(ydoc, activeSheetId, col); },
    insertColumnRight(col) { insertColumn(ydoc, activeSheetId, col); },
    deleteColumn(col) { deleteColumn(ydoc, activeSheetId, col); },
    sortColumn(col, direction) { doSort(col, direction); },
  });

  // --- Filter System ---
  const filterMgr = createFilterManager({
    gridEl,
    getActiveSheetId: () => activeSheetId,
    getActiveSheetLength: () => getActiveSheet().length,
    getCellValue: (sheetId, row, col) => store.getCellValue(sheetId, row, col),
    doSort,
    onFilterChange: () => doRender(),
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
  });

  function doRender() {
    const currentRange = rangeSelection.getRange();
    renderFormattedGrid({
      gridEl, ydoc, ysheet: getActiveSheet(),
      cols: DEFAULT_COLS, rows: DEFAULT_ROWS,
      cellRefEl, formulaInput, formatToolbar,
      onCellFocus(r, c) { activeRow = r; activeCol = c; },
    });
    resizeMgr.applyWidths(gridEl, DEFAULT_COLS);
    applyCondFormatting(gridEl, getRules(ydoc), (r, c) => {
      const yrow = getActiveSheet().get(r);
      return (yrow && c < yrow.length) ? yrow.get(c) : '';
    }, DEFAULT_ROWS, DEFAULT_COLS);
    if (currentRange) rangeSelection.setRange(currentRange);
    filterMgr.afterRender();
  }

  // --- Sheet Switching ---
  function switchSheet(sheetId: string) {
    getActiveSheet().unobserveDeep(onSheetChange);
    activeSheetId = sheetId;
    activeRow = 0;
    activeCol = 0;
    rangeSelection.clear();
    filterMgr.filterState.clearAll();
    if (cellRefEl) cellRefEl.textContent = 'A1';
    if (formulaInput) formulaInput.value = '';
    getActiveSheet().observeDeep(onSheetChange);
    doRender();
    tabBar?.setActive(sheetId);
  }

  function onSheetChange() { doRender(); }

  // --- Tab Bar ---
  let tabBar: TabBar | null = null;
  if (tabContainer) {
    tabBar = new TabBar(tabContainer, store, {
      onSwitch: switchSheet,
      onAdd() {
        const meta = store.addSheet();
        tabBar!.render();
        switchSheet(meta.id);
      },
      onRename(sheetId, newName) {
        store.renameSheet(sheetId, newName);
        tabBar!.render();
      },
      onDelete(sheetId) {
        if (store.getSheets().length <= 1) return;
        if (!store.deleteSheet(sheetId)) return;
        tabBar!.render();
        if (activeSheetId === sheetId) switchSheet(store.getSheets()[0].id);
      },
      onDuplicate(sheetId) {
        const meta = store.duplicateSheet(sheetId);
        if (!meta) return;
        tabBar!.render();
        switchSheet(meta.id);
      },
    }, activeSheetId);
  }

  store.observe(() => tabBar?.render());
  doRender();
  getActiveSheet().observeDeep(onSheetChange);
  getFormatMap(ydoc).observeDeep(() => doRender());
  observeRules(ydoc, () => doRender());

  if (formulaInput) setupFormulaBar(formulaInput, ydoc, getActiveSheet, () => activeRow, () => activeCol, doRender);
  setupPresence(provider, user, usersEl);
  Object.assign(window, { ydoc, provider, store });
}

document.addEventListener('DOMContentLoaded', init);
