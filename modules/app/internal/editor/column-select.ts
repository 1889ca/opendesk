/** Contract: contracts/app/rules.md */
/**
 * Column layout select widget.
 * Extracted to keep toolbar-selects.ts under the 200-line limit.
 */
import type { Editor } from '@tiptap/core';

const COLUMN_KEY = 'opendesk-columns';

const COLUMNS = [
  { label: '1 Column', value: '1' },
  { label: '2 Columns', value: '2' },
  { label: '3 Columns', value: '3' },
];

function applyColumns(n: string): void {
  document.documentElement.style.setProperty('--editor-columns', n);
  const gap = n === '1' ? '0' : '2rem';
  document.documentElement.style.setProperty('--editor-column-gap', gap);
}

export function buildColumnSelect(_editor: Editor): HTMLElement {
  const select = document.createElement('select');
  select.className = 'toolbar-select';
  select.setAttribute('aria-label', 'Column layout');
  select.setAttribute('title', 'Column layout');

  for (const col of COLUMNS) {
    const opt = document.createElement('option');
    opt.value = col.value;
    opt.textContent = col.label;
    select.appendChild(opt);
  }

  const saved = localStorage.getItem(COLUMN_KEY) || '1';
  select.value = saved;
  applyColumns(saved);

  select.addEventListener('change', () => {
    applyColumns(select.value);
    localStorage.setItem(COLUMN_KEY, select.value);
  });

  return select;
}
