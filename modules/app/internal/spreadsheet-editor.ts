/** Contract: contracts/app/rules.md */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getUserIdentity, getDocumentId } from './identity.ts';
import { setupTitleSync } from './title-sync.ts';

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

  // Yjs shared data: Y.Array of Y.Arrays (rows of cells)
  const ysheet = ydoc.getArray<Y.Array<string>>('sheet-0');

  // Initialize grid if empty
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

  let activeRow = 0;
  let activeCol = 0;

  function renderGrid() {
    ensureGrid();
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `3rem repeat(${DEFAULT_COLS}, minmax(5rem, 1fr))`;

    // Corner cell
    const corner = document.createElement('div');
    corner.className = 'cell header';
    gridEl.appendChild(corner);

    // Column headers
    for (let c = 0; c < DEFAULT_COLS; c++) {
      const hdr = document.createElement('div');
      hdr.className = 'cell header';
      hdr.textContent = colLabel(c);
      gridEl.appendChild(hdr);
    }

    // Rows
    for (let r = 0; r < Math.min(ysheet.length, DEFAULT_ROWS); r++) {
      // Row header
      const rh = document.createElement('div');
      rh.className = 'cell row-header';
      rh.textContent = String(r + 1);
      gridEl.appendChild(rh);

      const yrow = ysheet.get(r);
      for (let c = 0; c < DEFAULT_COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.contentEditable = 'true';
        cell.textContent = (yrow && c < yrow.length) ? yrow.get(c) : '';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

        cell.addEventListener('focus', () => {
          activeRow = r;
          activeCol = c;
          if (cellRefEl) cellRefEl.textContent = colLabel(c) + (r + 1);
          if (formulaInput) formulaInput.value = cell.textContent || '';
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

        gridEl.appendChild(cell);
      }
    }
  }

  renderGrid();

  // Re-render on remote changes
  ysheet.observeDeep(() => {
    renderGrid();
  });

  // Formula bar input syncs to active cell
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
