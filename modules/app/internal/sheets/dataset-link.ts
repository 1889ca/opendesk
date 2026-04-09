/** Contract: contracts/app/rules.md */

/**
 * KB Dataset integration for the spreadsheet editor.
 * Handles linking/unlinking datasets, populating cells from dataset rows,
 * and pushing changes back to the KB store.
 */

import { apiFetch } from '../shared/api-client.ts';
import { extractGridFromYjs, applyGridToYjs } from './sheet-import-export.ts';
import { buildPickerDialog } from './dataset-picker.ts';

type YSheet = {
  get(index: number): { get(col: number): string; length: number; delete(pos: number, len: number): void; insert(pos: number, vals: string[]): void };
  length: number;
};

type YDoc = {
  transact(fn: () => void): void;
};

type DatasetInfo = {
  id: string;
  name: string;
  columns: string[];
  rows: { cells: string[] }[];
};

export interface DatasetLinkState {
  linked: boolean;
  datasetId: string | null;
  datasetName: string | null;
  editMode: boolean;
}

let state: DatasetLinkState = {
  linked: false,
  datasetId: null,
  datasetName: null,
  editMode: false,
};

export function getDatasetLinkState(): DatasetLinkState {
  return { ...state };
}

/** Check if this sheet has a linked dataset on load. */
export async function initDatasetLink(
  docId: string,
  getYSheet: () => YSheet,
  getYDoc: () => YDoc,
  getCols: () => number,
  onStateChange: (state: DatasetLinkState) => void,
): Promise<void> {
  try {
    const res = await apiFetch(`/api/kb/datasets/linked/${encodeURIComponent(docId)}`);
    if (res.ok) {
      const ds: DatasetInfo = await res.json();
      state = {
        linked: true,
        datasetId: ds.id,
        datasetName: ds.name,
        editMode: false,
      };
      populateFromDataset(ds, getYSheet(), getYDoc(), getCols());
      onStateChange(state);
    }
  } catch {
    // No linked dataset — that's fine
  }
}

/** Open the dataset picker dialog. */
export async function showDatasetPicker(
  docId: string,
  getYSheet: () => YSheet,
  getYDoc: () => YDoc,
  getCols: () => number,
  onStateChange: (state: DatasetLinkState) => void,
): Promise<void> {
  const res = await apiFetch('/api/kb/datasets');
  if (!res.ok) {
    alert('Failed to load datasets');
    return;
  }

  const datasets: DatasetInfo[] = await res.json();
  if (datasets.length === 0) {
    alert('No datasets available. Create a dataset first.');
    return;
  }

  const dialog = buildPickerDialog(datasets, async (dsId) => {
    dialog.remove();
    await linkDataset(docId, dsId, getYSheet, getYDoc, getCols, onStateChange);
  }, () => dialog.remove());

  document.body.appendChild(dialog);
}

/** Link a dataset to this sheet. */
async function linkDataset(
  docId: string,
  datasetId: string,
  getYSheet: () => YSheet,
  getYDoc: () => YDoc,
  getCols: () => number,
  onStateChange: (state: DatasetLinkState) => void,
): Promise<void> {
  const linkRes = await apiFetch(
    `/api/kb/datasets/${encodeURIComponent(datasetId)}/link/${encodeURIComponent(docId)}`,
    { method: 'POST' },
  );
  if (!linkRes.ok) {
    alert('Failed to link dataset');
    return;
  }

  const dsRes = await apiFetch(`/api/kb/datasets/${encodeURIComponent(datasetId)}`);
  if (!dsRes.ok) return;

  const ds: DatasetInfo = await dsRes.json();
  state = { linked: true, datasetId: ds.id, datasetName: ds.name, editMode: false };
  populateFromDataset(ds, getYSheet(), getYDoc(), getCols());
  onStateChange(state);
}

/** Unlink the current dataset. */
export async function unlinkDataset(
  docId: string,
  onStateChange: (state: DatasetLinkState) => void,
): Promise<void> {
  await apiFetch(`/api/kb/datasets/unlink/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  });
  state = { linked: false, datasetId: null, datasetName: null, editMode: false };
  onStateChange(state);
}

/** Toggle edit mode for linked dataset cells. */
export function toggleEditMode(
  onStateChange: (state: DatasetLinkState) => void,
): void {
  state = { ...state, editMode: !state.editMode };
  onStateChange(state);
}

/** Push current sheet data back to the KB dataset. */
export async function pushToDataset(
  getYSheet: () => YSheet,
  getCols: () => number,
): Promise<void> {
  if (!state.datasetId) return;

  const grid = extractGridFromYjs(getYSheet(), getCols());
  // First row is column headers, rest are data rows
  const rows = grid.slice(1).map((r) => ({ cells: r }));

  const res = await apiFetch(
    `/api/kb/datasets/${encodeURIComponent(state.datasetId)}/rows`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    },
  );

  if (!res.ok) {
    alert('Failed to push changes to dataset');
    return;
  }
  alert('Changes pushed to dataset successfully');
}

/** Populate sheet cells from dataset columns + rows. */
function populateFromDataset(
  ds: DatasetInfo,
  ysheet: YSheet,
  ydoc: YDoc,
  cols: number,
): void {
  const grid: string[][] = [];
  // Header row from column names
  grid.push(ds.columns.map((c) => c));
  // Data rows
  for (const row of ds.rows) {
    grid.push(row.cells);
  }
  applyGridToYjs(grid, ysheet, ydoc, cols);
}

