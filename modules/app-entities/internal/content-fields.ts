/** Contract: contracts/app-entities/rules.md */

/** Field definition for dynamic form rendering. */
interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'url' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

const PERSON_FIELDS: FieldDef[] = [
  { key: 'role', label: 'Role', type: 'text', placeholder: 'e.g. Engineer' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'e.g. alice@example.com' },
  { key: 'bio', label: 'Bio', type: 'textarea', placeholder: 'Short biography' },
];

const ORG_FIELDS: FieldDef[] = [
  {
    key: 'orgType', label: 'Org Type', type: 'select',
    options: [
      { value: '', label: '(none)' },
      { value: 'company', label: 'Company' },
      { value: 'government', label: 'Government' },
      { value: 'ngo', label: 'NGO' },
      { value: 'academic', label: 'Academic' },
    ],
  },
  { key: 'website', label: 'Website', type: 'url', placeholder: 'https://...' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

const PROJECT_FIELDS: FieldDef[] = [
  {
    key: 'status', label: 'Status', type: 'select',
    options: [
      { value: '', label: '(none)' },
      { value: 'active', label: 'Active' },
      { value: 'completed', label: 'Completed' },
      { value: 'planned', label: 'Planned' },
    ],
  },
  { key: 'description', label: 'Description', type: 'textarea' },
];

const TERM_FIELDS: FieldDef[] = [
  { key: 'definition', label: 'Definition', type: 'textarea' },
  { key: 'domain', label: 'Domain/Context', type: 'text', placeholder: 'e.g. engineering' },
];

const FIELDS_BY_SUBTYPE: Record<string, FieldDef[]> = {
  person: PERSON_FIELDS,
  organization: ORG_FIELDS,
  project: PROJECT_FIELDS,
  term: TERM_FIELDS,
};

/**
 * Render subtype-specific content fields into a container.
 * Optionally pre-fills values from existing content.
 */
export function renderContentFields(
  container: HTMLElement,
  subtype: string,
  content?: Record<string, unknown>,
): void {
  container.innerHTML = '';
  const fields = FIELDS_BY_SUBTYPE[subtype] ?? [];

  for (const field of fields) {
    const label = document.createElement('label');
    label.htmlFor = `content-${field.key}`;
    label.textContent = field.label;
    container.appendChild(label);

    const value = content?.[field.key] ?? '';

    if (field.type === 'select' && field.options) {
      const select = document.createElement('select');
      select.id = `content-${field.key}`;
      select.name = field.key;
      for (const opt of field.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (String(value) === opt.value) option.selected = true;
        select.appendChild(option);
      }
      container.appendChild(select);
    } else if (field.type === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.id = `content-${field.key}`;
      textarea.name = field.key;
      textarea.rows = 3;
      textarea.value = String(value);
      if (field.placeholder) textarea.placeholder = field.placeholder;
      container.appendChild(textarea);
    } else {
      const input = document.createElement('input');
      input.id = `content-${field.key}`;
      input.name = field.key;
      input.type = field.type;
      input.value = String(value);
      if (field.placeholder) input.placeholder = field.placeholder;
      container.appendChild(input);
    }
  }
}

/**
 * Read content values from the rendered fields.
 */
export function readContentFields(
  container: HTMLElement,
  subtype: string,
): Record<string, unknown> {
  const fields = FIELDS_BY_SUBTYPE[subtype] ?? [];
  const content: Record<string, unknown> = {};

  for (const field of fields) {
    const el = container.querySelector(`#content-${field.key}`) as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | null;
    if (!el) continue;
    const val = el.value.trim();
    if (val) content[field.key] = val;
  }
  return content;
}
