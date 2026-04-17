/** Contract: contracts/app-sheets/rules.md */
import type { ValidationRule } from './data-validation-rules.ts';
import { getRuleForCell, getValidationRules } from './data-validation-rules.ts';
import { validate } from './data-validation-engine.ts';
import * as Y from 'yjs';

const INVALID_CLASS = 'dv-invalid';
const DROPDOWN_ARROW_CLASS = 'dv-dropdown-arrow';
const INPUT_MSG_CLASS = 'dv-input-message';

export function applyValidationIndicators(
  gridEl: HTMLElement,
  ydoc: Y.Doc,
  getData: (row: number, col: number) => string,
  rows: number,
  cols: number,
): void {
  clearValidationIndicators(gridEl);
  const rules = getValidationRules(ydoc);
  if (rules.length === 0) return;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rule = getRuleForCell(rules, r, c);
      if (!rule) continue;

      const cell = gridEl.querySelector<HTMLElement>(
        `[data-row="${r}"][data-col="${c}"]`,
      );
      if (!cell) continue;

      if (rule.type === 'list') {
        addDropdownArrow(cell);
      }

      const cellValue = getData(r, c);
      if (cellValue !== '') {
        const result = validate(rule, cellValue);
        if (!result.valid) {
          markInvalid(cell, result.message);
        }
      }
    }
  }
}

function clearValidationIndicators(gridEl: HTMLElement): void {
  gridEl.querySelectorAll(`.${INVALID_CLASS}`).forEach((el) => {
    (el as HTMLElement).classList.remove(INVALID_CLASS);
    (el as HTMLElement).removeAttribute('title');
  });
  gridEl.querySelectorAll(`.${DROPDOWN_ARROW_CLASS}`).forEach((el) => el.remove());
  gridEl.querySelectorAll(`.${INPUT_MSG_CLASS}`).forEach((el) => el.remove());
}

function addDropdownArrow(cell: HTMLElement): void {
  cell.style.position = 'relative';
  const arrow = document.createElement('span');
  arrow.className = DROPDOWN_ARROW_CLASS;
  arrow.textContent = '\u25BC';
  cell.appendChild(arrow);
}

function markInvalid(cell: HTMLElement, message?: string): void {
  cell.classList.add(INVALID_CLASS);
  if (message) cell.title = message;
}

export function showInputMessage(
  gridEl: HTMLElement, row: number, col: number, rule: ValidationRule,
): void {
  hideInputMessage(gridEl);
  if (!rule.inputTitle && !rule.inputMessage) return;

  const cell = gridEl.querySelector<HTMLElement>(
    `[data-row="${row}"][data-col="${col}"]`,
  );
  if (!cell) return;

  const tooltip = document.createElement('div');
  tooltip.className = INPUT_MSG_CLASS;
  if (rule.inputTitle) {
    const title = document.createElement('strong');
    title.textContent = rule.inputTitle;
    tooltip.appendChild(title);
  }
  if (rule.inputMessage) {
    const msg = document.createElement('span');
    msg.textContent = rule.inputMessage;
    tooltip.appendChild(msg);
  }

  const rect = cell.getBoundingClientRect();
  tooltip.style.left = `${rect.left}px`;
  tooltip.style.top = `${rect.bottom + 4}px`;
  document.body.appendChild(tooltip);
}

export function hideInputMessage(gridEl: HTMLElement): void {
  document.querySelectorAll(`.${INPUT_MSG_CLASS}`).forEach((el) => el.remove());
}

export function showValidationError(
  rule: ValidationRule, message: string,
): boolean {
  if (rule.onInvalid === 'reject') {
    showErrorPopup(rule.errorTitle ?? 'Invalid Input', message);
    return false;
  }
  showWarningPopup(rule.errorTitle ?? 'Warning', message);
  return true;
}

function showErrorPopup(title: string, message: string): void {
  showPopup(title, message, 'dv-error-popup');
}

function showWarningPopup(title: string, message: string): void {
  showPopup(title, message, 'dv-warning-popup');
}

function showPopup(title: string, message: string, className: string): void {
  document.querySelectorAll('.dv-popup-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'dv-popup-overlay';

  const popup = document.createElement('div');
  popup.className = `dv-popup ${className}`;

  const h = document.createElement('h4');
  h.textContent = title;
  popup.appendChild(h);

  const p = document.createElement('p');
  p.textContent = message;
  popup.appendChild(p);

  const btn = document.createElement('button');
  btn.className = 'dv-popup-ok';
  btn.textContent = 'OK';
  btn.addEventListener('click', () => overlay.remove());
  popup.appendChild(btn);

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}
