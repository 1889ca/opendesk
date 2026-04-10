/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';

const COLS = 8;
const ROWS = 8;

export function showTableGridPicker(editor: Editor, anchor: HTMLElement): void {
  document.querySelector('.table-grid-picker')?.remove();

  const picker = document.createElement('div');
  picker.className = 'table-grid-picker';

  const label = document.createElement('div');
  label.className = 'table-grid-label';
  label.textContent = 'Insert table';
  picker.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'table-grid';
  grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;

  let hoverCol = 0;
  let hoverRow = 0;

  function updateHighlight(): void {
    grid.querySelectorAll<HTMLElement>('.table-grid-cell').forEach(cell => {
      const c = Number(cell.dataset.col);
      const r = Number(cell.dataset.row);
      cell.classList.toggle('highlighted', c <= hoverCol && r <= hoverRow);
    });
    label.textContent = hoverCol > 0 ? `${hoverCol}×${hoverRow} table` : 'Insert table';
  }

  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      const cell = document.createElement('button');
      cell.className = 'table-grid-cell';
      cell.dataset.col = String(c);
      cell.dataset.row = String(r);
      cell.setAttribute('aria-label', `${c}×${r} table`);
      cell.addEventListener('mouseenter', () => { hoverCol = c; hoverRow = r; updateHighlight(); });
      cell.addEventListener('click', () => {
        editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run();
        picker.remove();
      });
      grid.appendChild(cell);
    }
  }

  picker.appendChild(grid);

  document.body.appendChild(picker);
  const rect = anchor.getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.top = `${rect.bottom + 4}px`;
  picker.style.left = `${rect.left}px`;

  function close(e: MouseEvent | KeyboardEvent): void {
    if (e instanceof KeyboardEvent ? e.key === 'Escape' : !picker.contains(e.target as Node)) {
      picker.remove();
      document.removeEventListener('click', close as EventListener);
      document.removeEventListener('keydown', close as EventListener);
    }
  }
  setTimeout(() => {
    document.addEventListener('click', close as EventListener);
    document.addEventListener('keydown', close as EventListener);
  }, 0);
}
