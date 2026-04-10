/** Contract: contracts/app-kb/rules.md */

import { attachKbLinkSuggestion } from './kb-link-suggestion.ts';

/** Field definition for dynamic metadata form rendering. */
export interface MetadataFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'url' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

const REFERENCE_FIELDS: MetadataFieldDef[] = [
  { key: 'doi', label: 'DOI', type: 'text', placeholder: '10.xxxx/xxxxx' },
  { key: 'authors', label: 'Authors (comma-separated)', type: 'text', placeholder: 'Author 1, Author 2' },
  { key: 'journal', label: 'Journal', type: 'text' },
  { key: 'year', label: 'Year', type: 'number' },
  { key: 'abstract', label: 'Abstract', type: 'textarea' },
  { key: 'url', label: 'URL', type: 'url' },
  { key: 'publisher', label: 'Publisher', type: 'text' },
];

const ENTITY_FIELDS: MetadataFieldDef[] = [
  {
    key: 'entityType', label: 'Entity Type', type: 'select',
    options: [
      { value: 'person', label: 'Person' },
      { value: 'organization', label: 'Organization' },
      { value: 'place', label: 'Place' },
    ],
  },
  { key: 'description', label: 'Description', type: 'textarea' },
];

const DATASET_FIELDS: MetadataFieldDef[] = [
  { key: 'format', label: 'Format', type: 'text', placeholder: 'CSV, JSON, etc.' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'sourceUrl', label: 'Source URL', type: 'url' },
];

const NOTE_FIELDS: MetadataFieldDef[] = [
  { key: 'body', label: 'Content', type: 'textarea' },
  {
    key: 'format', label: 'Format', type: 'select',
    options: [
      { value: 'markdown', label: 'Markdown' },
      { value: 'plain', label: 'Plain text' },
      { value: 'html', label: 'HTML' },
    ],
  },
];

const FIELDS_BY_TYPE: Record<string, MetadataFieldDef[]> = {
  reference: REFERENCE_FIELDS,
  entity: ENTITY_FIELDS,
  dataset: DATASET_FIELDS,
  note: NOTE_FIELDS,
};

/** Render the dynamic column editor for datasets. */
function renderColumnEditor(container: HTMLElement, existing?: unknown[]): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'kb-meta-columns';
  const label = document.createElement('label');
  label.textContent = 'Columns';
  container.appendChild(label);
  const cols = Array.isArray(existing) ? existing as { name: string; type: string }[] : [];

  function addRow(col?: { name: string; type: string }): void {
    const row = document.createElement('div');
    row.className = 'kb-meta-column-row';
    const n = Object.assign(document.createElement('input'), {
      type: 'text', placeholder: 'Column name', className: 'kb-meta-col-name', value: col?.name ?? '',
    });
    const t = Object.assign(document.createElement('input'), {
      type: 'text', placeholder: 'Type (text, number...)', className: 'kb-meta-col-type', value: col?.type ?? '',
    });
    const rm = Object.assign(document.createElement('button'), {
      type: 'button', className: 'btn btn-sm btn-delete', textContent: '\u00D7',
    });
    rm.addEventListener('click', () => row.remove());
    row.append(n, t, rm);
    wrapper.appendChild(row);
  }

  for (const c of cols) addRow(c);
  if (cols.length === 0) addRow();
  const addBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'btn btn-sm btn-secondary', textContent: '+ Add column',
  });
  addBtn.addEventListener('click', () => addRow());
  container.append(wrapper, addBtn);
}

/** Render metadata fields for a given entry type into a container. */
export function renderMetaFields(
  container: HTMLElement,
  entryType: string,
  values?: Record<string, unknown>,
): void {
  container.innerHTML = '';
  const fields = FIELDS_BY_TYPE[entryType] ?? [];

  for (const field of fields) {
    const label = document.createElement('label');
    label.htmlFor = `kb-meta-${field.key}`;
    label.textContent = field.label;
    container.appendChild(label);

    const value = values?.[field.key] ?? '';

    if (field.type === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.id = `kb-meta-${field.key}`;
      textarea.name = field.key;
      textarea.rows = 3;
      textarea.value = String(value);
      if (field.placeholder) textarea.placeholder = field.placeholder;
      // Attach [[ KB inline link suggestion for note body
      if (entryType === 'note' && field.key === 'body') {
        attachKbLinkSuggestion(textarea);
      }
      container.appendChild(textarea);
    } else if (field.type === 'select' && field.options) {
      const select = document.createElement('select');
      select.id = `kb-meta-${field.key}`;
      select.name = field.key;
      for (const opt of field.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (String(value) === opt.value) option.selected = true;
        select.appendChild(option);
      }
      container.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.type = field.type;
      input.id = `kb-meta-${field.key}`;
      input.name = field.key;
      input.value = String(value);
      if (field.placeholder) input.placeholder = field.placeholder;
      container.appendChild(input);
    }
  }

  // Dataset column editor
  if (entryType === 'dataset') {
    renderColumnEditor(container, values?.columns as unknown[]);
  }
}

/** Read column definitions from the column editor. */
function readColumnEditor(container: HTMLElement): { name: string; type: string }[] {
  const rows = Array.from(container.querySelectorAll('.kb-meta-column-row'));
  const columns: { name: string; type: string }[] = [];
  for (const row of rows) {
    const name = (row.querySelector('.kb-meta-col-name') as HTMLInputElement)?.value.trim();
    const type = (row.querySelector('.kb-meta-col-type') as HTMLInputElement)?.value.trim();
    if (name && type) columns.push({ name, type });
  }
  return columns;
}

/** Read metadata values from the rendered fields. */
export function readMetaFields(container: HTMLElement, entryType: string): Record<string, unknown> {
  const fields = FIELDS_BY_TYPE[entryType] ?? [];
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const el = container.querySelector(`#kb-meta-${field.key}`) as HTMLInputElement | null;
    if (!el) continue;
    const val = el.value.trim();
    if (!val) continue;
    if (field.key === 'authors') {
      result.authors = val.split(',').map((a) => a.trim()).filter(Boolean);
    } else if (field.type === 'number') {
      result[field.key] = Number(val);
    } else {
      result[field.key] = val;
    }
  }

  // Include column definitions for datasets
  if (entryType === 'dataset') {
    const columns = readColumnEditor(container);
    if (columns.length > 0) result.columns = columns;
  }

  return result;
}
