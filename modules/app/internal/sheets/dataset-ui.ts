/** Contract: contracts/app/rules.md */

/**
 * Dataset UI helpers for the spreadsheet editor.
 * Manages the dataset indicator, read-only cell states,
 * and the dataset link/unlink button behavior.
 */

import {
  showDatasetPicker,
  unlinkDataset,
  getDatasetLinkState,
  type DatasetLinkState,
} from './dataset-link.ts';

/** Update the dataset link indicator badge in the toolbar. */
export function updateDatasetIndicator(ds: DatasetLinkState): void {
  const indicator = document.getElementById('dataset-indicator');
  const linkBtn = document.getElementById('dataset-link-btn');
  if (!indicator) return;

  if (ds.linked && ds.datasetName) {
    indicator.hidden = false;
    indicator.textContent = `Linked: ${ds.datasetName}`;
    indicator.className = 'dataset-indicator linked';
    if (linkBtn) linkBtn.textContent = 'Unlink';
  } else {
    indicator.hidden = true;
    if (linkBtn) linkBtn.textContent = 'Dataset';
  }
}

/** Toggle contentEditable on data cells and add/remove dataset-cell class. */
export function setCellsReadOnly(
  gridEl: HTMLElement,
  readOnly: boolean,
): void {
  const cells = gridEl.querySelectorAll('.cell[contenteditable]');
  cells.forEach((cell) => {
    (cell as HTMLElement).contentEditable = readOnly ? 'false' : 'true';
    if (readOnly) {
      (cell as HTMLElement).classList.add('dataset-cell');
    } else {
      (cell as HTMLElement).classList.remove('dataset-cell');
    }
  });
}

/** Wire the dataset link/unlink button click handler. */
export function setupDatasetButtons(
  docId: string,
  getYSheet: () => any,
  getYDoc: () => any,
  getCols: () => number,
  onStateChange: (ds: DatasetLinkState) => void,
): void {
  document.getElementById('dataset-link-btn')?.addEventListener('click', () => {
    const ds = getDatasetLinkState();
    if (ds.linked) {
      if (confirm('Unlink this sheet from its dataset?')) {
        unlinkDataset(docId, onStateChange);
      }
    } else {
      showDatasetPicker(docId, getYSheet, getYDoc, getCols, onStateChange);
    }
  });
}
