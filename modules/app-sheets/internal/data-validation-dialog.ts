/** Contract: contracts/app-sheets/rules.md */
import type { ValidationRule, ValidationType, NumberCondition } from './data-validation-rules.ts';
import { generateRuleId } from './data-validation-rules.ts';
import { colLabel } from './grid-render.ts';

const TYPES: ValidationType[] = ['list', 'number', 'integer', 'date', 'text-length', 'custom'];
const CONDITIONS: NumberCondition[] = [
  'between', 'not-between', 'equal', 'not-equal',
  'greater', 'greater-equal', 'less', 'less-equal',
];

export function openDataValidationDialog(
  onAdd: (rule: ValidationRule) => void,
  defaultRow: number, defaultCol: number,
  endRow?: number, endCol?: number,
): void {
  document.querySelector('.dv-dialog-overlay')?.remove();

  const overlay = mkEl('div', 'dv-dialog-overlay');
  const dialog = mkEl('div', 'dv-dialog');
  overlay.appendChild(dialog);

  dialog.appendChild(mkHeading('Data Validation'));

  const form = mkEl('form', 'dv-form') as HTMLFormElement;
  dialog.appendChild(form);

  const rangeRow = mkEl('div', 'dv-range-row');
  const sRowIn = mkNumber(rangeRow, 'Start Row', defaultRow + 1, 1, 999);
  const sColIn = mkNumber(rangeRow, 'Start Col', defaultCol, 0, 25);
  const eRowIn = mkNumber(rangeRow, 'End Row', (endRow ?? defaultRow) + 1, 1, 999);
  const eColIn = mkNumber(rangeRow, 'End Col', endCol ?? defaultCol, 0, 25);
  form.appendChild(rangeRow);

  const typeSelect = mkSelect(form, 'Type', TYPES);
  const dynamicArea = mkEl('div', 'dv-dynamic');
  form.appendChild(dynamicArea);

  const blankCheck = mkCheckbox(form, 'Allow blank cells', true);

  const msgSection = mkEl('details', 'dv-messages');
  const summary = document.createElement('summary');
  summary.textContent = 'Input / Error Messages';
  msgSection.appendChild(summary);
  const inputTitle = mkText(msgSection, 'Input Title', 'dvInputTitle');
  const inputMsg = mkText(msgSection, 'Input Message', 'dvInputMsg');
  const errorTitle = mkText(msgSection, 'Error Title', 'dvErrorTitle');
  const errorMsg = mkText(msgSection, 'Error Message', 'dvErrorMsg');
  form.appendChild(msgSection);

  function rebuildDynamic(): void {
    dynamicArea.innerHTML = '';
    const t = typeSelect.value as ValidationType;
    if (t === 'list') {
      mkTextarea(dynamicArea, 'Items (one per line)', 'dvItems');
    } else if (t === 'number' || t === 'integer' || t === 'date' || t === 'text-length') {
      const condSel = mkSelect(dynamicArea, 'Condition', CONDITIONS);
      condSel.dataset.field = 'condition';
      mkText(dynamicArea, 'Value 1', 'dvVal1');
      mkText(dynamicArea, 'Value 2 (for between)', 'dvVal2');
    } else if (t === 'custom') {
      mkText(dynamicArea, 'Regex Pattern', 'dvPattern');
    }
  }

  typeSelect.addEventListener('change', rebuildDynamic);
  rebuildDynamic();

  const actions = mkEl('div', 'dv-actions');
  const addBtn = mkButton('Apply', 'dv-apply-btn');
  const cancelBtn = mkButton('Cancel', 'dv-cancel-btn');
  actions.appendChild(addBtn);
  actions.appendChild(cancelBtn);
  form.appendChild(actions);

  cancelBtn.addEventListener('click', (e) => { e.preventDefault(); overlay.remove(); });
  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const rule = buildRule(typeSelect, sRowIn, sColIn, eRowIn, eColIn, dynamicArea, blankCheck, msgSection);
    if (rule) { onAdd(rule); overlay.remove(); }
  });

  document.body.appendChild(overlay);
}

function buildRule(
  typeSelect: HTMLSelectElement,
  sRow: HTMLInputElement, sCol: HTMLInputElement,
  eRow: HTMLInputElement, eCol: HTMLInputElement,
  area: HTMLElement, blankCheck: HTMLInputElement,
  msgSection: HTMLElement,
): ValidationRule | null {
  const type = typeSelect.value as ValidationType;
  const rule: ValidationRule = {
    id: generateRuleId(),
    type,
    range: {
      startRow: parseInt(sRow.value, 10) - 1,
      startCol: parseInt(sCol.value, 10),
      endRow: parseInt(eRow.value, 10) - 1,
      endCol: parseInt(eCol.value, 10),
    },
    allowBlank: blankCheck.checked,
    onInvalid: 'reject',
    inputTitle: getVal(msgSection, 'dvInputTitle') || undefined,
    inputMessage: getVal(msgSection, 'dvInputMsg') || undefined,
    errorTitle: getVal(msgSection, 'dvErrorTitle') || undefined,
    errorMessage: getVal(msgSection, 'dvErrorMsg') || undefined,
  };

  if (type === 'list') {
    const raw = (area.querySelector('[data-field="dvItems"]') as HTMLTextAreaElement)?.value ?? '';
    rule.items = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  } else if (type === 'number' || type === 'integer' || type === 'date' || type === 'text-length') {
    rule.condition = (area.querySelector('[data-field="condition"]') as HTMLSelectElement)?.value as NumberCondition;
    rule.value1 = getVal(area, 'dvVal1') || undefined;
    rule.value2 = getVal(area, 'dvVal2') || undefined;
  } else if (type === 'custom') {
    rule.value1 = getVal(area, 'dvPattern') || undefined;
  }

  return rule;
}

// --- DOM helpers (keep small, same pattern as cond-format-dialog) ---

function mkEl(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag); e.className = cls; return e;
}

function mkHeading(text: string): HTMLElement {
  const h = document.createElement('h3'); h.textContent = text; return h;
}

function mkSelect(parent: HTMLElement, label: string, opts: string[]): HTMLSelectElement {
  const row = mkEl('div', 'dv-field');
  const lbl = document.createElement('label'); lbl.textContent = label;
  const sel = document.createElement('select');
  for (const o of opts) {
    const opt = document.createElement('option');
    opt.value = o; opt.textContent = o.replace(/-/g, ' '); sel.appendChild(opt);
  }
  row.appendChild(lbl); row.appendChild(sel); parent.appendChild(row);
  return sel;
}

function mkNumber(parent: HTMLElement, label: string, val: number, min: number, max: number): HTMLInputElement {
  const row = mkEl('div', 'dv-field');
  const lbl = document.createElement('label'); lbl.textContent = label;
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = String(min); inp.max = String(max); inp.value = String(val);
  row.appendChild(lbl); row.appendChild(inp); parent.appendChild(row);
  return inp;
}

function mkText(parent: HTMLElement, label: string, name: string): HTMLInputElement {
  const row = mkEl('div', 'dv-field');
  const lbl = document.createElement('label'); lbl.textContent = label;
  const inp = document.createElement('input'); inp.type = 'text'; inp.dataset.field = name;
  row.appendChild(lbl); row.appendChild(inp); parent.appendChild(row);
  return inp;
}

function mkTextarea(parent: HTMLElement, label: string, name: string): HTMLTextAreaElement {
  const row = mkEl('div', 'dv-field');
  const lbl = document.createElement('label'); lbl.textContent = label;
  const ta = document.createElement('textarea'); ta.rows = 5; ta.dataset.field = name;
  row.appendChild(lbl); row.appendChild(ta); parent.appendChild(row);
  return ta;
}

function mkCheckbox(parent: HTMLElement, label: string, checked: boolean): HTMLInputElement {
  const row = mkEl('div', 'dv-field dv-field--inline');
  const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = checked;
  const lbl = document.createElement('label'); lbl.textContent = label;
  row.appendChild(inp); row.appendChild(lbl); parent.appendChild(row);
  return inp;
}

function mkButton(text: string, cls: string): HTMLButtonElement {
  const btn = document.createElement('button'); btn.className = cls; btn.textContent = text; return btn;
}

function getVal(area: HTMLElement, name: string): string {
  return (area.querySelector(`[data-field="${name}"]`) as HTMLInputElement)?.value ?? '';
}
