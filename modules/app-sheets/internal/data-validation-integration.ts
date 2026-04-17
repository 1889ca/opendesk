/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import { getValidationRules, getRuleForCell, observeValidationRules } from './data-validation-rules.ts';
import { validate } from './data-validation-engine.ts';
import { showInputMessage, hideInputMessage, showValidationError } from './data-validation-renderer.ts';
import { openDropdown, closeDropdown } from './data-validation-dropdown.ts';

export function handleValidationFocus(
  gridEl: HTMLElement,
  ydoc: Y.Doc,
  row: number,
  col: number,
): void {
  closeDropdown();
  const rules = getValidationRules(ydoc);
  const rule = getRuleForCell(rules, row, col);
  if (!rule) {
    hideInputMessage(gridEl);
    return;
  }
  showInputMessage(gridEl, row, col, rule);
}

export function attachValidationListeners(
  gridEl: HTMLElement,
  ydoc: Y.Doc,
  getSheet: () => Y.Array<Y.Array<string>>,
  doRender: () => void,
): void {
  gridEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('dv-dropdown-arrow')) return;
    const cell = target.parentElement;
    if (!cell?.dataset.row || !cell?.dataset.col) return;

    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);
    const rules = getValidationRules(ydoc);
    const rule = getRuleForCell(rules, row, col);
    if (!rule || rule.type !== 'list') return;

    e.stopPropagation();
    openDropdown(cell, rule, ydoc, getSheet(), row, col, doRender);
  });
}

export function attachValidationOnBlur(
  gridEl: HTMLElement,
  ydoc: Y.Doc,
  getSheet: () => Y.Array<Y.Array<string>>,
): void {
  gridEl.addEventListener('focusout', (e) => {
    const target = e.target as HTMLElement;
    if (!target.dataset.row || !target.dataset.col) return;

    const row = parseInt(target.dataset.row, 10);
    const col = parseInt(target.dataset.col, 10);
    const rules = getValidationRules(ydoc);
    const rule = getRuleForCell(rules, row, col);
    if (!rule) return;

    const val = target.textContent ?? '';
    if (val === '' && rule.allowBlank) return;

    const result = validate(rule, val);
    if (!result.valid) {
      const allowed = showValidationError(rule, result.message ?? 'Invalid value');
      if (!allowed) {
        const yrow = getSheet().get(row);
        const prev = (yrow && col < yrow.length) ? yrow.get(col) : '';
        target.textContent = prev;
      }
    }
  });
}

export function observeValidation(ydoc: Y.Doc, callback: () => void): void {
  observeValidationRules(ydoc, callback);
}
