/** Contract: contracts/app/rules.md */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getUserIdentity, getDocumentId } from './shared/identity.ts';
import { setupTitleSync } from './shared/title-sync.ts';
import { createFormatToolbar, updateToolbarState } from './sheets-format-toolbar.ts';
import { getCellFormat, getFormatMap } from './sheets-format-store.ts';
import { applyCellFormat, getDisplayValue } from './sheets-format-renderer.ts';
import { attachFormatShortcuts } from './sheets-format-shortcuts.ts';

const DEFAULT_COLS = 26;
const DEFAULT_ROWS = 50;

function colLabel(index: number): string {
  let label = '';
  let i = index;
  while (i >= 0) {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  }
  return label;
}

function init() {
  const gridEl = document.getElementById('spreadsheet')!;
  const statusEl = document.getElementById('status');
  const usersEl = document.getElementById('users');
  const cellRefEl = document.getElementById('cell-ref');
  const formulaInput = document.getElementById('formula-input') as HTMLInputElement | null;
  const formatBarContainer = document.getElementById('format-bar-container');
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
      if (statusEl) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'status connected';
      }
    },
    onDisconnect() {
      if (statusEl) {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'status disconnected';
      }
    },
  });

  const ysheet = ydoc.getArray<Y.Array<string>>('sheet-0');

  let activeRow = 0;
  let activeCol = 0;

  // --- Format Toolbar ---
  let formatToolbar: HTMLElement | null = null;
  if (formatBarContainer) {
    formatToolbar = createFormatToolbar(formatBarContainer, ydoc, {
      getActiveCell: () => ({ row: activeRow, col: activeCol }),
      onFormatChanged: () => renderGrid(),
    });
  }

  // --- Keyboard Shortcuts ---
  attachFormatShortcuts(ydoc, {
    getActiveCell: () => ({ row: activeRow, col: activeCol }),
    onFormatChanged: () => renderGrid(),
  });

  // --- Grid ---
  function ensureGrid() {
    if (ysheet.length === 0) {
      ydoc.transact(() => {
        for (let r = 0; r < DEFAULT_ROWS; r++) {
          const row = new Y.Array<string>();
          const cells: string[] = [];
          for (let c = 0; c < DEFAULT_COLS; c++) cells.push('');
          row.insert(0, cells);
          ysheet.insert(ysheet.length, [row]);
        }
      });
    }
  }

  function renderGrid() {
    ensureGrid();
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `3rem repeat(${DEFAULT_COLS}, minmax(5rem, 1fr))`;

    const corner = document.createElement('div');
    corner.className = 'cell header';
    gridEl.appendChild(corner);

    for (let c = 0; c < DEFAULT_COLS; c++) {
      const hdr = document.createElement('div');
      hdr.className = 'cell header';
      hdr.textContent = colLabel(c);
      gridEl.appendChild(hdr);
    }

    for (let r = 0; r < Math.min(ysheet.length, DEFAULT_ROWS); r++) {
      const rh = document.createElement('div');
      rh.className = 'cell row-header';
      rh.textContent = String(r + 1);
      gridEl.appendChild(rh);

      const yrow = ysheet.get(r);
      for (let c = 0; c < DEFAULT_COLS; c++) {
        const rawValue = (yrow && c < yrow.length) ? yrow.get(c) : '';
        const fmt = getCellFormat(ydoc, r, c);

        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.contentEditable = 'true';
        cell.textContent = getDisplayValue(rawValue, fmt);
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

        applyCellFormat(cell, fmt);
        attachCellEvents(cell, r, c, rawValue);
        gridEl.appendChild(cell);
      }
    }
  }

  function attachCellEvents(cell: HTMLElement, r: number, c: number, rawValue: string): void {
    cell.addEventListener('focus', () => {
      activeRow = r;
      activeCol = c;
      if (cellRefEl) cellRefEl.textContent = colLabel(c) + (r + 1);
      if (formulaInput) formulaInput.value = rawValue;
      if (formatToolbar) updateToolbarState(formatToolbar, getCellFormat(ydoc, r, c));
    });

    cell.addEventListener('blur', () => {
      const val = cell.textContent || '';
      const yrow = ysheet.get(r);
      if (yrow && yrow.get(c) !== val) {
        ydoc.transact(() => {
          yrow.delete(c, 1);
          yrow.insert(c, [val]);
        });
      }
    });
  }

  renderGrid();

  // Re-render on remote changes (cell values or formats)
  ysheet.observeDeep(() => renderGrid());
  getFormatMap(ydoc).observeDeep(() => renderGrid());

  // Formula bar
  if (formulaInput) {
    formulaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = formulaInput.value;
        const yrow = ysheet.get(activeRow);
        if (yrow) {
          ydoc.transact(() => {
            yrow.delete(activeCol, 1);
            yrow.insert(activeCol, [val]);
          });
        }
        renderGrid();
      }
    });
  }

  // Presence
  function updateUsers() {
    if (!usersEl || !provider.awareness) return;
    const states = provider.awareness.getStates();
    const names: string[] = [];
    states.forEach((state: { user?: { name?: string } }) => {
      if (state.user?.name) names.push(state.user.name);
    });
    usersEl.textContent = names.join(', ') || '-';
  }
  provider.awareness?.setLocalStateField('user', user);
  provider.awareness?.on('change', updateUsers);
  updateUsers();

  Object.assign(window, { ydoc, provider, ysheet });
}

document.addEventListener('DOMContentLoaded', init);
