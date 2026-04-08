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
import { createRangeSelection, type RangeSelection } from './sheets/range-selection.ts';
import { createClipboardManager, type ClipboardManager } from './sheets/clipboard.ts';

const DEFAULT_COLS = 26;
const DEFAULT_ROWS = 50;

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

  const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/collab`;
  const provider = new HocuspocusProvider({
    url: wsUrl,
    name: documentId,
    document: ydoc,
    onConnect() {
      if (statusEl) { statusEl.textContent = 'Connected'; statusEl.className = 'status connected'; }
    },
    onDisconnect() {
      if (statusEl) { statusEl.textContent = 'Disconnected'; statusEl.className = 'status disconnected'; }
    },
  });

  const store = new SheetStore(ydoc);
  let activeSheetId = store.getSheets()[0]?.id || 'sheet-0';
  let activeRow = 0;
  let activeCol = 0;

  function getActiveSheet(): Y.Array<Y.Array<string>> {
    return store.getSheetData(activeSheetId);
  }

  // --- Format Toolbar ---
  let formatToolbar: HTMLElement | null = null;
  if (formatBarContainer) {
    formatToolbar = createFormatToolbar(formatBarContainer, ydoc, {
      getActiveCell: () => ({ row: activeRow, col: activeCol }),
      onFormatChanged: () => doRender(),
    });
  }

  attachFormatShortcuts(ydoc, {
    getActiveCell: () => ({ row: activeRow, col: activeCol }),
    onFormatChanged: () => doRender(),
  });

  // --- Range Selection & Clipboard ---
  const rangeSelection = createRangeSelection(gridEl);
  const clipboardMgr = createClipboardManager(gridEl, rangeSelection, store, {
    ydoc,
    ysheet: () => getActiveSheet(),
  });

  function doRender() {
    const currentRange = rangeSelection.getRange();
    renderFormattedGrid({
      gridEl, ydoc, ysheet: getActiveSheet(),
      cols: DEFAULT_COLS, rows: DEFAULT_ROWS,
      cellRefEl, formulaInput, formatToolbar,
      onCellFocus(r, c) { activeRow = r; activeCol = c; },
    });
    if (currentRange) rangeSelection.setRange(currentRange);
  }

  // --- Sheet Switching ---
  function switchSheet(sheetId: string) {
    getActiveSheet().unobserveDeep(onSheetChange);
    activeSheetId = sheetId;
    activeRow = 0;
    activeCol = 0;
    rangeSelection.clear();
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

  // Formula bar
  if (formulaInput) {
    formulaInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const yrow = getActiveSheet().get(activeRow);
      if (yrow) {
        ydoc.transact(() => { yrow.delete(activeCol, 1); yrow.insert(activeCol, [formulaInput.value]); });
      }
      doRender();
    });
  }

  // Presence
  function updateUsers() {
    if (!usersEl || !provider.awareness) return;
    const names: string[] = [];
    provider.awareness.getStates().forEach((state: { user?: { name?: string } }) => {
      if (state.user?.name) names.push(state.user.name);
    });
    usersEl.textContent = names.join(', ') || '-';
  }
  provider.awareness?.setLocalStateField('user', user);
  provider.awareness?.on('change', updateUsers);
  updateUsers();

  Object.assign(window, { ydoc, provider, store });
}

document.addEventListener('DOMContentLoaded', init);
