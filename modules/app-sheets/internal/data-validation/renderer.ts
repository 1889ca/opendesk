/** Contract: contracts/app-sheets/data-validation.md */
import type { ValidationRule } from './types.ts';
import { cellInRange } from './types.ts';
import { validate } from './engine.ts';
import { showDropdown, closeDropdown } from './dropdown.ts';
import * as Y from 'yjs';

export interface RendererContext {
  gridEl: HTMLElement;
  ydoc: Y.Doc;
  rules: ValidationRule[];
  rows: number;
  cols: number;
  getCellValue: (row: number, col: number) => string;
  onCellValueChange: (row: number, col: number, value: string) => void;
}

export function applyValidationIndicators(ctx: RendererContext): void {
  const { gridEl, rules, rows, cols, getCellValue } = ctx;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = gridEl.querySelector<HTMLElement>(
        `[data-row="${r}"][data-col="${c}"]`,
      );
      if (!cell) continue;

      const rule = findRule(rules, r, c);

      cell.classList.remove('dv-has-rule', 'dv-invalid', 'dv-warning', 'dv-info');
      removeDropdownArrow(cell);
      removeInputTooltip(cell);

      if (!rule) continue;

      cell.classList.add('dv-has-rule');

      if (rule.type === 'list') {
        addDropdownArrow(cell, rule, ctx);
      }

      if (rule.inputMessage) {
        addInputTooltip(cell, rule);
      }

      const value = getCellValue(r, c);
      if (value !== '') {
        const result = validate(rule, value);
        if (!result.valid) {
          applyErrorClass(cell, rule.errorStyle);
          cell.title = result.message || 'Invalid value';
        }
      }
    }
  }
}

function findRule(
  rules: ValidationRule[],
  row: number,
  col: number,
): ValidationRule | null {
  for (const rule of rules) {
    if (cellInRange(row, col, rule.range)) return rule;
  }
  return null;
}

function applyErrorClass(
  cell: HTMLElement,
  style: string,
): void {
  if (style === 'warning') cell.classList.add('dv-warning');
  else if (style === 'info') cell.classList.add('dv-info');
  else cell.classList.add('dv-invalid');
}

function addDropdownArrow(
  cell: HTMLElement,
  rule: ValidationRule,
  ctx: RendererContext,
): void {
  const arrow = document.createElement('span');
  arrow.className = 'dv-dropdown-arrow';
  arrow.textContent = '\u25BE';
  arrow.addEventListener('click', (e) => {
    e.stopPropagation();
    const row = parseInt(cell.dataset.row || '0', 10);
    const col = parseInt(cell.dataset.col || '0', 10);
    showDropdown(cell, rule, (value) => {
      ctx.onCellValueChange(row, col, value);
    });
  });
  cell.style.position = 'relative';
  cell.appendChild(arrow);
}

function removeDropdownArrow(cell: HTMLElement): void {
  cell.querySelector('.dv-dropdown-arrow')?.remove();
}

function addInputTooltip(cell: HTMLElement, rule: ValidationRule): void {
  cell.addEventListener('focus', () => showInputMessage(cell, rule), { once: false });
  cell.addEventListener('blur', () => hideInputMessage(), { once: false });
}

function removeInputTooltip(_cell: HTMLElement): void {
  hideInputMessage();
}

let activeTooltip: HTMLElement | null = null;

function showInputMessage(cell: HTMLElement, rule: ValidationRule): void {
  hideInputMessage();
  if (!rule.inputMessage) return;

  const tip = document.createElement('div');
  tip.className = 'dv-input-tooltip';
  if (rule.inputTitle) {
    const title = document.createElement('strong');
    title.textContent = rule.inputTitle;
    tip.appendChild(title);
    tip.appendChild(document.createElement('br'));
  }
  tip.appendChild(document.createTextNode(rule.inputMessage));

  const rect = cell.getBoundingClientRect();
  tip.style.position = 'fixed';
  tip.style.left = rect.left + 'px';
  tip.style.top = (rect.bottom + 4) + 'px';
  tip.style.zIndex = '9998';

  document.body.appendChild(tip);
  activeTooltip = tip;
}

function hideInputMessage(): void {
  activeTooltip?.remove();
  activeTooltip = null;
}

export function cleanupValidation(): void {
  closeDropdown();
  hideInputMessage();
}
