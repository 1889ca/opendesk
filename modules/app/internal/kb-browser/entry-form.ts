/** Contract: contracts/app/rules.md */

import { type KBEntryRecord, createEntryApi, updateEntryApi } from './kb-api.ts';
import { renderMetaFields, readMetaFields } from './form-meta-fields.ts';

type FormCallback = () => void;

const ENTRY_TYPES = [
  { value: 'reference', label: 'Reference' },
  { value: 'entity', label: 'Entity' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'note', label: 'Note' },
];

/** Build the create/edit entry form overlay. Returns the overlay element. */
export function buildEntryForm(onSave: FormCallback): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'kb-form-overlay';
  overlay.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'kb-form-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'Entry form');

  const titleEl = document.createElement('h2');
  titleEl.className = 'kb-form__title';
  titleEl.id = 'kb-form-title';
  titleEl.textContent = 'New Entry';

  const form = buildFormElement(onSave, overlay);

  dialog.appendChild(titleEl);
  dialog.appendChild(form);
  overlay.appendChild(dialog);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });

  return overlay;
}

function buildFormElement(onSave: FormCallback, overlay: HTMLElement): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'kb-form';
  form.id = 'kb-entry-form';

  // Title field
  form.appendChild(createLabel('Title', 'kb-field-title'));
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'kb-field-title';
  titleInput.placeholder = 'Entry title';
  titleInput.required = true;
  form.appendChild(titleInput);

  // Entry type selector
  form.appendChild(createLabel('Type', 'kb-field-type'));
  const typeSelect = document.createElement('select');
  typeSelect.id = 'kb-field-type';
  typeSelect.name = 'entryType';
  for (const opt of ENTRY_TYPES) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    typeSelect.appendChild(option);
  }
  form.appendChild(typeSelect);

  // Tags
  form.appendChild(createLabel('Tags (comma-separated)', 'kb-field-tags'));
  const tagsInput = document.createElement('input');
  tagsInput.type = 'text';
  tagsInput.id = 'kb-field-tags';
  tagsInput.placeholder = 'tag1, tag2';
  form.appendChild(tagsInput);

  // Dynamic metadata fields container
  const metaContainer = document.createElement('div');
  metaContainer.id = 'kb-meta-fields';
  form.appendChild(metaContainer);

  typeSelect.addEventListener('change', () => {
    renderMetaFields(metaContainer, typeSelect.value);
  });
  renderMetaFields(metaContainer, typeSelect.value);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'kb-form__buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { overlay.hidden = true; });

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = 'Save';

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(submitBtn);
  form.appendChild(btnRow);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit(form, overlay, onSave).catch(console.error);
  });

  return form;
}

/** Open the form for creating a new entry. */
export function openCreateForm(overlay: HTMLElement): void {
  const form = overlay.querySelector('#kb-entry-form') as HTMLFormElement;
  const titleEl = overlay.querySelector('#kb-form-title') as HTMLElement;
  titleEl.textContent = 'New Entry';
  form.reset();
  form.dataset.entryId = '';
  form.dataset.entryTypeFixed = '';
  const typeSelect = form.querySelector('#kb-field-type') as HTMLSelectElement;
  typeSelect.disabled = false;
  renderMetaFields(form.querySelector('#kb-meta-fields')!, typeSelect.value);
  overlay.hidden = false;
}

/** Open the form for editing an existing entry. */
export function openEditForm(overlay: HTMLElement, entry: KBEntryRecord): void {
  const form = overlay.querySelector('#kb-entry-form') as HTMLFormElement;
  const titleEl = overlay.querySelector('#kb-form-title') as HTMLElement;
  titleEl.textContent = 'Edit Entry';
  form.dataset.entryId = entry.id;
  form.dataset.entryTypeFixed = entry.entryType;

  (form.querySelector('#kb-field-title') as HTMLInputElement).value = entry.title;
  const typeSelect = form.querySelector('#kb-field-type') as HTMLSelectElement;
  typeSelect.value = entry.entryType;
  typeSelect.disabled = true;
  (form.querySelector('#kb-field-tags') as HTMLInputElement).value = entry.tags.join(', ');

  renderMetaFields(form.querySelector('#kb-meta-fields')!, entry.entryType, entry.metadata);
  overlay.hidden = false;
}

async function handleSubmit(form: HTMLFormElement, overlay: HTMLElement, onSave: FormCallback): Promise<void> {
  const title = (form.querySelector('#kb-field-title') as HTMLInputElement).value.trim();
  const entryType = form.dataset.entryTypeFixed || (form.querySelector('#kb-field-type') as HTMLSelectElement).value;
  const tags = (form.querySelector('#kb-field-tags') as HTMLInputElement).value
    .split(',').map((t) => t.trim()).filter(Boolean);
  const metadata = readMetaFields(form.querySelector('#kb-meta-fields')!, entryType);
  const entityId = form.dataset.entryId;

  try {
    if (entityId) {
      await updateEntryApi(entityId, { title, metadata, tags });
    } else {
      await createEntryApi({ entryType, title, metadata, tags });
    }
    overlay.hidden = true;
    onSave();
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Save failed');
  }
}

function createLabel(text: string, htmlFor: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.htmlFor = htmlFor;
  label.textContent = text;
  return label;
}
