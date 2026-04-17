/** Contract: contracts/app-sheets/rules.md */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getUserIdentity, getDocumentId, setupTitleSync, mountAppToolbar, setupShareDialog } from '@opendesk/app';
import { createFormatToolbar } from './format/toolbar.ts';
import { getFormatMap } from './format/store.ts';
import { attachFormatShortcuts } from './format/shortcuts.ts';
import { renderFormattedGrid } from './grid-render.ts';
import { SheetStore } from './sheet-store.ts';
import { setupTabBar } from './tab-bar-setup.ts';
import { createRangeSelection } from './range-selection.ts';
import { createClipboardManager } from './clipboard.ts';
import { createColRowResize } from './col-row-resize.ts';
import { buildContextMenu } from './freeze-panes.ts';
import { sortByColumn } from './sort-engine.ts';
import { createFilterManager } from './filter-manager.ts';
import { getRules, observeRules } from './cond-format-rules.ts';
import { applyCondFormatting } from './cond-format-renderer.ts';
import { setupPresence } from './presence.ts';
import { createNameBox } from './name-box.ts';
import { openNamedRangeDialog } from './named-range-dialog.ts';
import { observeNamedRanges } from './named-ranges.ts';
import { openPivotDialog } from './pivot/pivot-dialog.ts';
import { applyValidationIndicators } from './data-validation-renderer.ts';
import { handleValidationFocus, attachValidationListeners, observeValidation } from './data-validation-integration.ts';
import { appendCondFormatButton, appendDataValidationButton, setupFormulaBar } from './toolbar-buttons.ts';

const DEFAULT_COLS = 26;
const DEFAULT_ROWS = 50;

function init() {
  mountAppToolbar();
  const gridEl = document.getElementById('spreadsheet')!;
  const statusEl = document.getElementById('status');
  const usersEl = document.getElementById('users');
  const cellRefEl = document.getElementById('cell-ref');
  const formulaInput = document.getElementById('formula-input') as HTMLInputElement | null;
  const nameBoxEl = document.getElementById('name-box') as HTMLInputElement | null;
  const formatBarContainer = document.getElementById('format-bar-container');
  const tabContainer = document.getElementById('sheet-tab-container');
  const insertNamedRangesBtn = document.getElementById('insert-named-ranges');
  const insertPivotBtn = document.getElementById('insert-pivot');
  if (!gridEl) return;

  const documentId = getDocumentId();
  setupTitleSync(documentId, 'OpenDesk Spreadsheet');
  setupShareDialog(documentId);
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
    appendDataValidationButton(formatBarContainer, ydoc, () => activeRow, () => activeCol);
  }
  attachFormatShortcuts(ydoc, fmtCb);

  const rangeSelection = createRangeSelection(gridEl);

  // --- Name Box ---
  const nameBox = nameBoxEl
    ? createNameBox({
        ydoc,
        element: nameBoxEl,
        getActiveSheetId: () => activeSheetId,
        getSelectedRange: () => rangeSelection.getRange(),
        navigateTo(row, col) {
          const target = gridEl.querySelector<HTMLElement>(
            `[data-row="${row}"][data-col="${col}"]`,
          );
          target?.focus();
        },
        getCurrentCell: () => ({ row: activeRow, col: activeCol }),
      })
    : null;
  const clipboardMgr = createClipboardManager(gridEl, rangeSelection, store, { ydoc, ysheet: () => getActiveSheet() });
  const resizeMgr = createColRowResize(gridEl, ydoc);

  // --- Sort helper ---
  function doSort(col: number, direction: 'asc' | 'desc'): void {
    sortByColumn(ydoc, getActiveSheet(), col, direction);
    doRender();
  }

  // --- Context Menu (includes freeze pane callbacks) ---
  const ctxMenu = buildContextMenu({
    gridEl, ydoc, store,
    getActiveSheetId: () => activeSheetId,
    getActiveSheet,
    doRender,
    doSort,
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

  insertNamedRangesBtn?.addEventListener('click', () => openNamedRangeDialog(ydoc, store.getSheets(), activeSheetId));
  insertPivotBtn?.addEventListener('click', () => openPivotDialog({
    ydoc, store, activeSheetId,
    onCreated(newSheetId) { tabBar?.render(); switchSheet(newSheetId); },
  }));

  function doRender() {
    const currentRange = rangeSelection.getRange();
    renderFormattedGrid({
      gridEl, ydoc, ysheet: getActiveSheet(),
      cols: DEFAULT_COLS, rows: DEFAULT_ROWS,
      cellRefEl, formulaInput, formatToolbar,
      store, activeSheetId,
      frozenRows: store.getFrozenRows(activeSheetId),
      frozenCols: store.getFrozenCols(activeSheetId),
      onCellFocus(r, c) {
        activeRow = r;
        activeCol = c;
        nameBox?.update(r, c);
        handleValidationFocus(gridEl, ydoc, r, c);
      },
    });
    resizeMgr.applyWidths(gridEl, DEFAULT_COLS);
    applyCondFormatting(gridEl, getRules(ydoc), (r, c) => {
      const yrow = getActiveSheet().get(r);
      return (yrow && c < yrow.length) ? yrow.get(c) : '';
    }, DEFAULT_ROWS, DEFAULT_COLS);
    const dvGetData = (r: number, c: number) => {
      const yrow = getActiveSheet().get(r);
      return (yrow && c < yrow.length) ? yrow.get(c) : '';
    };
    applyValidationIndicators(gridEl, ydoc, dvGetData, DEFAULT_ROWS, DEFAULT_COLS);
    attachValidationListeners(gridEl, ydoc, getActiveSheet, doRender);
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

  const tabBar = setupTabBar(tabContainer, store, switchSheet, activeSheetId);

  store.observe(() => tabBar?.render());
  doRender();
  getActiveSheet().observeDeep(onSheetChange);
  getFormatMap(ydoc).observeDeep(() => doRender());
  observeRules(ydoc, () => doRender());

  if (formulaInput) setupFormulaBar(formulaInput, ydoc, getActiveSheet, () => activeRow, () => activeCol, doRender);
  setupPresence(provider, user, usersEl);
  observeNamedRanges(ydoc, () => doRender());
  observeValidation(ydoc, () => doRender());
  Object.assign(window, { ydoc, provider, store });
}

document.addEventListener('DOMContentLoaded', init);
