/** Contract: contracts/app-slides/rules.md */

import type { SlideElement, TableData } from './types.ts';

/** Render a table element as an HTML table within the slide */
export function renderTableElement(
  el: SlideElement,
  onCellBlur: (row: number, col: number, value: string) => void,
): HTMLElement {
  const div = document.createElement('div');
  div.className = 'slide-element slide-element--table';
  div.dataset.type = 'table';
  div.dataset.elementId = el.id;
  applyTransform(div, el);

  const tableData = el.tableData || createDefaultTableData(3, 3);
  const table = document.createElement('table');
  table.className = 'slide-table';

  for (let r = 0; r < tableData.rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < tableData.cols; c++) {
      const td = document.createElement('td');
      td.className = 'slide-table-cell';
      td.contentEditable = 'true';
      td.textContent = tableData.cells[r]?.[c] ?? '';

      const row = r;
      const col = c;
      td.addEventListener('blur', () => {
        onCellBlur(row, col, td.textContent || '');
      });

      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  div.appendChild(table);
  return div;
}

/** Create a default empty table grid */
export function createDefaultTableData(rows: number, cols: number): TableData {
  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push('');
    }
    cells.push(row);
  }
  return { rows, cols, cells };
}

function applyTransform(div: HTMLElement, el: SlideElement): void {
  div.style.left = `${el.x}%`;
  div.style.top = `${el.y}%`;
  div.style.width = `${el.width}%`;
  div.style.height = `${el.height}%`;
  if (el.rotation) {
    div.style.transform = `rotate(${el.rotation}deg)`;
  }
}
