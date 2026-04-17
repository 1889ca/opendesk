/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import { addRule } from './cond-format-rules.ts';
import { openCondFormatDialog } from './cond-format-dialog.ts';
import { addValidationRule } from './data-validation-rules.ts';
import { openDataValidationDialog } from './data-validation-dialog.ts';

export function appendCondFormatButton(
  container: HTMLElement, ydoc: Y.Doc, getCol: () => number,
): void {
  const btn = document.createElement('button');
  btn.className = 'format-btn';
  btn.textContent = 'Cond Format';
  btn.title = 'Conditional Formatting';
  btn.addEventListener('click', () => openCondFormatDialog((rule) => addRule(ydoc, rule), getCol()));
  container.appendChild(btn);
}

export function appendDataValidationButton(
  container: HTMLElement, ydoc: Y.Doc,
  getRow: () => number, getCol: () => number,
): void {
  const btn = document.createElement('button');
  btn.className = 'format-btn';
  btn.textContent = 'Validate';
  btn.title = 'Data Validation';
  btn.addEventListener('click', () => {
    openDataValidationDialog((rule) => addValidationRule(ydoc, rule), getRow(), getCol());
  });
  container.appendChild(btn);
}

export function setupFormulaBar(
  input: HTMLInputElement, ydoc: Y.Doc,
  getSheet: () => Y.Array<Y.Array<string>>,
  getRow: () => number, getCol: () => number, render: () => void,
): void {
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const yrow = getSheet().get(getRow());
    if (yrow) ydoc.transact(() => { yrow.delete(getCol(), 1); yrow.insert(getCol(), [input.value]); });
    render();
  });
}
