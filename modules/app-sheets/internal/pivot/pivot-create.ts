/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import { buildPivot, type ValueFieldConfig } from './pivot-engine.ts';
import { pivotToGrid, writePivotToSheet } from './pivot-renderer.ts';
import { applyDisplayMode } from './pivot-transforms.ts';
import { sortPivotRows, filterPivotRows } from './pivot-sort-filter.ts';
import { getCheckedIndices, type ValueFieldEntry } from './pivot-field-list.ts';
import type { PivotOptionsResult } from './pivot-options.ts';
import type { SheetStore } from '../sheet-store.ts';

export function readSheetData(store: SheetStore, sheetId: string): string[][] {
  const ysheet = store.getSheetData(sheetId);
  const result: string[][] = [];
  for (let r = 0; r < ysheet.length; r++) {
    const yrow = ysheet.get(r);
    const row: string[] = [];
    for (let c = 0; c < yrow.length; c++) row.push(yrow.get(c) ?? '');
    while (row.length > 0 && row[row.length - 1] === '') row.pop();
    result.push(row);
  }
  while (result.length > 0 && result[result.length - 1].length === 0) {
    result.pop();
  }
  return result;
}

export interface CreatePivotArgs {
  ydoc: Y.Doc;
  store: SheetStore;
  onCreated: (newSheetId: string) => void;
  sourceSheetId: string;
  sourceName: string;
  rowCbs: HTMLInputElement[];
  colCbs: HTMLInputElement[];
  valueEntries: ValueFieldEntry[];
  options: PivotOptionsResult;
  errMsg: HTMLElement;
  overlay: HTMLElement;
}

export function executePivotCreate(args: CreatePivotArgs): void {
  const {
    ydoc, store, onCreated, sourceSheetId, sourceName,
    rowCbs, colCbs, valueEntries, options, errMsg, overlay,
  } = args;
  errMsg.style.display = 'none';

  const data = readSheetData(store, sourceSheetId);
  if (data.length < 2) {
    errMsg.textContent = 'Source sheet needs at least a header and one data row.';
    errMsg.style.display = '';
    return;
  }

  const rowFields = getCheckedIndices(rowCbs);
  if (rowFields.length === 0) {
    errMsg.textContent = 'Select at least one Row Field.';
    errMsg.style.display = '';
    return;
  }

  const vfConfigs: ValueFieldConfig[] = valueEntries.map((e) => ({
    fieldIndex: parseInt(e.fieldSelect.value, 10),
    aggregation: e.aggSelect.value as ValueFieldConfig['aggregation'],
  }));

  const config = {
    rowFields,
    colFields: getCheckedIndices(colCbs),
    valueFields: vfConfigs,
    dataRows: data.slice(1),
    headers: data[0],
  };

  let result = buildPivot(config);
  const displayModes = vfConfigs.map(() => options.displayMode);

  for (let vi = 0; vi < vfConfigs.length; vi++) {
    if (options.displayMode !== 'value') {
      result = applyDisplayMode(result, vi, options.displayMode);
    }
  }
  if (options.sort) result = sortPivotRows(result, options.sort);
  if (options.filter) result = filterPivotRows(result, options.filter);

  const grid = pivotToGrid(result, config, displayModes);
  const meta = store.addSheet(`Pivot (${sourceName})`);
  writePivotToSheet(ydoc, store, meta.id, grid);

  overlay.remove();
  onCreated(meta.id);
}
