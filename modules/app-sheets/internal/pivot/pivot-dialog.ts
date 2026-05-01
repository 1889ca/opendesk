/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import type { SheetStore } from '../sheet-store.ts';
import {
  labeledSelect,
  checkboxGroup,
  createValueFieldEntry,
  type ValueFieldEntry,
} from './pivot-field-list.ts';
import { createPivotOptions } from './pivot-options.ts';
import { readSheetData, executePivotCreate } from './pivot-create.ts';

export interface PivotDialogDeps {
  ydoc: Y.Doc;
  store: SheetStore;
  activeSheetId: string;
  onCreated: (newSheetId: string) => void;
}

export function openPivotDialog(deps: PivotDialogDeps): void {
  const { store, activeSheetId } = deps;

  document.querySelector('.pivot-overlay')?.remove();

  const sheets = store.getSheets();
  const sheetOptions = sheets.map((s) => s.name);
  const sheetIds = sheets.map((s) => s.id);

  const overlay = document.createElement('div');
  overlay.className = 'pivot-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pivot-dialog';
  overlay.appendChild(dialog);

  const heading = document.createElement('h3');
  heading.textContent = 'Insert Pivot Table';
  dialog.appendChild(heading);

  const form = document.createElement('div');
  form.className = 'pivot-form';
  dialog.appendChild(form);

  const sheetSel = labeledSelect(
    form, 'Source Sheet', sheetOptions,
    sheets.find((s) => s.id === activeSheetId)?.name,
  );

  let rowCbs: HTMLInputElement[] = [];
  let colCbs: HTMLInputElement[] = [];
  let valueEntries: ValueFieldEntry[] = [];

  const fieldsArea = document.createElement('div');
  fieldsArea.className = 'pivot-fields-area';
  form.appendChild(fieldsArea);

  const errMsg = document.createElement('p');
  errMsg.className = 'pivot-error';
  errMsg.style.display = 'none';
  form.appendChild(errMsg);

  function buildFields(): void {
    fieldsArea.innerHTML = '';
    valueEntries = [];
    const srcId = sheetIds[sheetOptions.indexOf(sheetSel.value)];
    const data = readSheetData(store, srcId);
    const headers = data[0] ?? [];

    if (headers.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'pivot-empty-msg';
      msg.textContent = 'No data found in selected sheet.';
      fieldsArea.appendChild(msg);
      return;
    }

    const labels = headers.map((h, i) => h || `Column ${i + 1}`);
    rowCbs = checkboxGroup(fieldsArea, 'Row Fields', labels);
    colCbs = checkboxGroup(fieldsArea, 'Column Fields', labels);

    const valSection = document.createElement('div');
    valSection.className = 'pivot-field';
    const valLabel = document.createElement('label');
    valLabel.className = 'pivot-label';
    valLabel.textContent = 'Value Fields';
    valSection.appendChild(valLabel);

    const valList = document.createElement('div');
    valList.className = 'pivot-value-list';
    valSection.appendChild(valList);
    fieldsArea.appendChild(valSection);

    addValueEntry(valList, labels, false);

    const addBtn = document.createElement('button');
    addBtn.className = 'pivot-btn pivot-add-value-btn';
    addBtn.textContent = '+ Add Value';
    addBtn.addEventListener('click', () => addValueEntry(valList, labels, true));
    valSection.appendChild(addBtn);
  }

  function addValueEntry(
    parent: HTMLElement, labels: string[], removable: boolean,
  ): void {
    const entry = createValueFieldEntry(parent, labels, removable, () => {
      entry.container.remove();
      valueEntries = valueEntries.filter((e) => e !== entry);
    });
    valueEntries.push(entry);
  }

  buildFields();
  sheetSel.addEventListener('change', buildFields);

  const optionsUI = createPivotOptions(form);

  const actions = document.createElement('div');
  actions.className = 'pivot-actions';
  form.appendChild(actions);

  const createBtn = document.createElement('button');
  createBtn.className = 'pivot-btn pivot-create-btn';
  createBtn.textContent = 'Create Pivot Table';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'pivot-btn pivot-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  actions.appendChild(createBtn);
  actions.appendChild(cancelBtn);

  cancelBtn.addEventListener('click', () => overlay.remove());
  createBtn.addEventListener('click', () => {
    const srcId = sheetIds[sheetOptions.indexOf(sheetSel.value)];
    executePivotCreate({
      ydoc: deps.ydoc, store, onCreated: deps.onCreated,
      sourceSheetId: srcId, sourceName: sheetSel.value,
      rowCbs, colCbs, valueEntries,
      options: optionsUI.getOptions(), errMsg, overlay,
    });
  });

  document.body.appendChild(overlay);
}
