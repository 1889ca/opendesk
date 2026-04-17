/** Contract: contracts/app-sheets/rules.md */
import type { ValidationRule } from './data-validation-rules.ts';
import * as Y from 'yjs';

const DROPDOWN_CLASS = 'dv-dropdown';

export function openDropdown(
  cell: HTMLElement,
  rule: ValidationRule,
  ydoc: Y.Doc,
  ysheet: Y.Array<Y.Array<string>>,
  row: number,
  col: number,
  onCommit: () => void,
): void {
  closeDropdown();
  if (rule.type !== 'list' || !rule.items) return;

  const rect = cell.getBoundingClientRect();
  const dropdown = document.createElement('div');
  dropdown.className = DROPDOWN_CLASS;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom}px`;
  dropdown.style.minWidth = `${rect.width}px`;

  const currentValue = cell.dataset.rawValue ?? cell.textContent ?? '';

  for (const item of rule.items) {
    const option = document.createElement('div');
    option.className = 'dv-dropdown-item';
    if (item === currentValue) option.classList.add('dv-dropdown-item--selected');
    option.textContent = item;
    option.addEventListener('click', () => {
      commitValue(ydoc, ysheet, row, col, item);
      cell.textContent = item;
      cell.dataset.rawValue = item;
      closeDropdown();
      onCommit();
    });
    dropdown.appendChild(option);
  }

  document.body.appendChild(dropdown);
  requestAnimationFrame(() => {
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
  });
}

export function closeDropdown(): void {
  document.querySelectorAll(`.${DROPDOWN_CLASS}`).forEach((el) => el.remove());
  document.removeEventListener('click', handleOutsideClick);
  document.removeEventListener('keydown', handleEscape);
}

function handleOutsideClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (target.closest(`.${DROPDOWN_CLASS}`)) return;
  if (target.classList.contains('dv-dropdown-arrow')) return;
  closeDropdown();
}

function handleEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeDropdown();
}

function commitValue(
  ydoc: Y.Doc,
  ysheet: Y.Array<Y.Array<string>>,
  row: number,
  col: number,
  value: string,
): void {
  const yrow = ysheet.get(row);
  if (!yrow) return;
  ydoc.transact(() => {
    yrow.delete(col, 1);
    yrow.insert(col, [value]);
  });
}
