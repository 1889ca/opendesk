/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import {
  getNamedRanges,
  defineNamedRange,
  deleteNamedRange,
  isValidName,
  type NamedRange,
} from './named-ranges.ts';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function buildRow(
  nr: NamedRange,
  ydoc: Y.Doc,
  onEdit: (nr: NamedRange) => void,
  onDelete: (name: string) => void,
): HTMLElement {
  const row = el('div', 'nr-row');

  const name = el('span', 'nr-name');
  name.textContent = nr.name;

  const ref = el('span', 'nr-ref');
  ref.textContent = `${nr.sheetId}!${nr.range}`;

  const editBtn = el('button', 'nr-btn nr-edit-btn');
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => onEdit(nr));

  const delBtn = el('button', 'nr-btn nr-delete-btn');
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => onDelete(nr.name));

  row.appendChild(name);
  row.appendChild(ref);
  row.appendChild(editBtn);
  row.appendChild(delBtn);
  return row;
}

function buildForm(
  ydoc: Y.Doc,
  initial: Partial<NamedRange>,
  sheets: Array<{ id: string; name: string }>,
  onSave: () => void,
): HTMLElement {
  const form = el('div', 'nr-form');

  const nameInput = el('input', 'nr-input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Name (e.g. TaxRate)';
  nameInput.value = initial.name ?? '';

  const sheetSelect = el('select', 'nr-select');
  for (const s of sheets) {
    const opt = el('option');
    opt.value = s.id;
    opt.textContent = s.name;
    if (s.id === initial.sheetId) opt.selected = true;
    sheetSelect.appendChild(opt);
  }

  const rangeInput = el('input', 'nr-input');
  rangeInput.type = 'text';
  rangeInput.placeholder = 'Range (e.g. A1 or B2:C5)';
  rangeInput.value = initial.range ?? '';

  const errMsg = el('p', 'nr-error');
  errMsg.style.display = 'none';

  const saveBtn = el('button', 'nr-btn nr-save-btn');
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const range = rangeInput.value.trim();
    const sheetId = sheetSelect.value;

    if (!isValidName(name)) {
      errMsg.textContent = 'Invalid name. Use letters, digits, underscores only, starting with a letter or underscore.';
      errMsg.style.display = '';
      return;
    }
    if (!range) {
      errMsg.textContent = 'Range is required.';
      errMsg.style.display = '';
      return;
    }

    defineNamedRange(ydoc, { name, sheetId, range });
    onSave();
  });

  form.appendChild(nameInput);
  form.appendChild(sheetSelect);
  form.appendChild(rangeInput);
  form.appendChild(errMsg);
  form.appendChild(saveBtn);
  return form;
}

export function openNamedRangeDialog(
  ydoc: Y.Doc,
  sheets: Array<{ id: string; name: string }>,
  activeSheetId: string,
): void {
  const existing = document.querySelector('.nr-overlay');
  if (existing) existing.remove();

  const overlay = el('div', 'nr-overlay');
  const dialog = el('div', 'nr-dialog');
  overlay.appendChild(dialog);

  const heading = el('h3');
  heading.textContent = 'Named Ranges';
  dialog.appendChild(heading);

  const listArea = el('div', 'nr-list');
  const formArea = el('div', 'nr-form-area');
  dialog.appendChild(listArea);
  dialog.appendChild(formArea);

  function renderList(): void {
    listArea.innerHTML = '';
    const ranges = getNamedRanges(ydoc);
    if (ranges.length === 0) {
      const empty = el('p', 'nr-empty');
      empty.textContent = 'No named ranges defined.';
      listArea.appendChild(empty);
    }
    for (const nr of ranges) {
      listArea.appendChild(
        buildRow(
          nr, ydoc,
          (editNr) => {
            formArea.innerHTML = '';
            formArea.appendChild(buildForm(ydoc, editNr, sheets, () => {
              formArea.innerHTML = '';
              renderList();
            }));
          },
          (name) => {
            deleteNamedRange(ydoc, name);
            renderList();
          },
        ),
      );
    }
  }

  // "Add new" button
  const addBtn = el('button', 'nr-btn nr-add-btn');
  addBtn.textContent = '+ New Named Range';
  addBtn.addEventListener('click', () => {
    formArea.innerHTML = '';
    formArea.appendChild(
      buildForm(ydoc, { sheetId: activeSheetId }, sheets, () => {
        formArea.innerHTML = '';
        renderList();
      }),
    );
  });
  dialog.appendChild(addBtn);

  const closeBtn = el('button', 'nr-btn nr-close-btn');
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => overlay.remove());
  dialog.appendChild(closeBtn);

  renderList();
  document.body.appendChild(overlay);
}
