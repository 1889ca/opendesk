/** Contract: contracts/app/rules.md */

/**
 * Dataset picker dialog DOM builder.
 * Renders a modal overlay listing available KB datasets for selection.
 */

type DatasetInfo = {
  id: string;
  name: string;
  columns: string[];
  rows: { cells: string[] }[];
};

/** Build the dataset picker dialog DOM element. */
export function buildPickerDialog(
  datasets: DatasetInfo[],
  onSelect: (id: string) => void,
  onClose: () => void,
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'dataset-picker-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'dataset-picker-dialog';

  const header = document.createElement('div');
  header.className = 'dataset-picker-header';
  header.innerHTML = '<h3>Link KB Dataset</h3>';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dataset-picker-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', onClose);
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const list = document.createElement('div');
  list.className = 'dataset-picker-list';
  for (const ds of datasets) {
    const item = document.createElement('button');
    item.className = 'dataset-picker-item';
    item.textContent = `${ds.name} (${ds.columns.length} cols, ${ds.rows.length} rows)`;
    item.addEventListener('click', () => onSelect(ds.id));
    list.appendChild(item);
  }
  dialog.appendChild(list);

  overlay.appendChild(dialog);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) onClose();
  });

  return overlay;
}
