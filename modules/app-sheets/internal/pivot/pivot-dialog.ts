/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import { buildPivot, type AggregationType } from './pivot-engine.ts';
import { pivotToGrid, writePivotToSheet } from './pivot-renderer.ts';
import type { SheetStore } from '../sheet-store.ts';

const AGGREGATIONS: AggregationType[] = ['SUM', 'COUNT', 'AVERAGE', 'MIN', 'MAX'];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function labeledSelect(
  parent: HTMLElement,
  labelText: string,
  options: string[],
  defaultVal?: string,
): HTMLSelectElement {
  const wrap = el('div', 'pivot-field');
  const lbl = el('label', 'pivot-label');
  lbl.textContent = labelText;
  const sel = el('select', 'pivot-select');
  for (const opt of options) {
    const o = el('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === defaultVal) o.selected = true;
    sel.appendChild(o);
  }
  wrap.appendChild(lbl);
  wrap.appendChild(sel);
  parent.appendChild(wrap);
  return sel;
}

function checkboxGroup(
  parent: HTMLElement,
  labelText: string,
  options: string[],
): HTMLInputElement[] {
  const wrap = el('div', 'pivot-field');
  const lbl = el('label', 'pivot-label');
  lbl.textContent = labelText;
  wrap.appendChild(lbl);
  const inputs: HTMLInputElement[] = [];
  const list = el('div', 'pivot-checkbox-group');
  for (let i = 0; i < options.length; i++) {
    const row = el('label', 'pivot-checkbox-row');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.value = String(i);
    cb.dataset.idx = String(i);
    const span = el('span');
    span.textContent = options[i];
    row.appendChild(cb);
    row.appendChild(span);
    list.appendChild(row);
    inputs.push(cb);
  }
  wrap.appendChild(list);
  parent.appendChild(wrap);
  return inputs;
}

function getCheckedIndices(inputs: HTMLInputElement[]): number[] {
  return inputs.filter((cb) => cb.checked).map((cb) => parseInt(cb.value, 10));
}

/** Read raw sheet data (all rows) from the store for a given sheet. */
function readSheetData(store: SheetStore, sheetId: string): string[][] {
  const ysheet = store.getSheetData(sheetId);
  const result: string[][] = [];
  for (let r = 0; r < ysheet.length; r++) {
    const yrow = ysheet.get(r);
    const row: string[] = [];
    for (let c = 0; c < yrow.length; c++) {
      row.push(yrow.get(c) ?? '');
    }
    // Trim trailing empties
    while (row.length > 0 && row[row.length - 1] === '') row.pop();
    result.push(row);
  }
  // Trim trailing empty rows
  while (result.length > 0 && result[result.length - 1].length === 0) result.pop();
  return result;
}

export interface PivotDialogDeps {
  ydoc: Y.Doc;
  store: SheetStore;
  activeSheetId: string;
  onCreated: (newSheetId: string) => void;
}

/** Open the Pivot Table configuration dialog. */
export function openPivotDialog(deps: PivotDialogDeps): void {
  const { ydoc, store, activeSheetId, onCreated } = deps;

  const existing = document.querySelector('.pivot-overlay');
  if (existing) existing.remove();

  const sheets = store.getSheets();
  const sheetOptions = sheets.map((s) => s.name);
  const sheetIds = sheets.map((s) => s.id);

  const overlay = el('div', 'pivot-overlay');
  const dialog = el('div', 'pivot-dialog');
  overlay.appendChild(dialog);

  const heading = el('h3');
  heading.textContent = 'Insert Pivot Table';
  dialog.appendChild(heading);

  const form = el('div', 'pivot-form');
  dialog.appendChild(form);

  // Source sheet selector
  const sheetSel = labeledSelect(form, 'Source Sheet', sheetOptions,
    sheets.find((s) => s.id === activeSheetId)?.name);

  let headers: string[] = [];
  let rowCbs: HTMLInputElement[] = [];
  let colCbs: HTMLInputElement[] = [];
  let valSel: HTMLSelectElement | null = null;
  let aggSel: HTMLSelectElement | null = null;

  const fieldsArea = el('div', 'pivot-fields-area');
  form.appendChild(fieldsArea);

  const errMsg = el('p', 'pivot-error');
  errMsg.style.display = 'none';
  form.appendChild(errMsg);

  function buildFields(): void {
    fieldsArea.innerHTML = '';
    const sourceSheetName = sheetSel.value;
    const sourceSheetId = sheetIds[sheetOptions.indexOf(sourceSheetName)];
    const data = readSheetData(store, sourceSheetId);
    headers = data[0] ?? [];

    if (headers.length === 0) {
      const msg = el('p', 'pivot-empty-msg');
      msg.textContent = 'No data found in selected sheet.';
      fieldsArea.appendChild(msg);
      return;
    }

    // Use column index as label if header is empty
    const displayHeaders = headers.map((h, i) => h || `Column ${i + 1}`);

    rowCbs = checkboxGroup(fieldsArea, 'Row Fields', displayHeaders);
    colCbs = checkboxGroup(fieldsArea, 'Column Fields', displayHeaders);
    valSel = labeledSelect(fieldsArea, 'Value Field', displayHeaders);
    aggSel = labeledSelect(fieldsArea, 'Aggregation', AGGREGATIONS, 'SUM');
  }

  buildFields();
  sheetSel.addEventListener('change', buildFields);

  const actions = el('div', 'pivot-actions');
  form.appendChild(actions);

  const createBtn = el('button', 'pivot-btn pivot-create-btn');
  createBtn.textContent = 'Create Pivot Table';
  const cancelBtn = el('button', 'pivot-btn pivot-cancel-btn');
  cancelBtn.textContent = 'Cancel';
  actions.appendChild(createBtn);
  actions.appendChild(cancelBtn);

  cancelBtn.addEventListener('click', () => overlay.remove());

  createBtn.addEventListener('click', () => {
    errMsg.style.display = 'none';

    const sourceSheetName = sheetSel.value;
    const sourceSheetId = sheetIds[sheetOptions.indexOf(sourceSheetName)];
    const data = readSheetData(store, sourceSheetId);

    if (data.length < 2) {
      errMsg.textContent = 'Source sheet needs at least a header row and one data row.';
      errMsg.style.display = '';
      return;
    }

    const rowFields = getCheckedIndices(rowCbs);
    const colFields = getCheckedIndices(colCbs);
    const valueField = valSel ? parseInt(valSel.value === '' ? '0' : String(
      Array.from(valSel.options).findIndex((o) => o.selected),
    ), 10) : 0;
    const aggregation = (aggSel?.value ?? 'SUM') as AggregationType;

    if (rowFields.length === 0) {
      errMsg.textContent = 'Select at least one Row Field.';
      errMsg.style.display = '';
      return;
    }

    const config = {
      rowFields,
      colFields,
      valueField,
      aggregation,
      dataRows: data.slice(1),
      headers: data[0],
    };

    const result = buildPivot(config);
    const grid = pivotToGrid(result, config);

    // Create a new sheet for the pivot output
    const meta = store.addSheet(`Pivot (${sourceSheetName})`);
    writePivotToSheet(ydoc, store, meta.id, grid);

    overlay.remove();
    onCreated(meta.id);
  });

  document.body.appendChild(overlay);
}
