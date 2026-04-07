/** Contract: contracts/app/rules.md */
import { apiFetch } from '../../shared/api-client.ts';

interface FormField {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}

const FIELDS: FormField[] = [
  { label: 'Title', name: 'title', required: true, placeholder: 'Reference title' },
  { label: 'Authors', name: 'authors', placeholder: 'Comma-separated names' },
  { label: 'DOI', name: 'doi', placeholder: 'e.g. 10.1234/example' },
  { label: 'Year', name: 'year', placeholder: 'e.g. 2024' },
  { label: 'Source', name: 'source', placeholder: 'Journal or publisher' },
  { label: 'URL', name: 'url', placeholder: 'https://...' },
];

function createField(field: FormField): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'reference-library-field';

  const label = document.createElement('label');
  label.textContent = field.label;
  label.className = 'reference-library-field-label';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = field.name;
  input.className = 'reference-library-field-input';
  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.required) input.required = true;

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

async function lookupDOI(doi: string): Promise<Record<string, unknown> | null> {
  const res = await apiFetch(`/api/references/lookup/doi/${encodeURIComponent(doi)}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Render an inline add-reference form inside the sidebar.
 * Inserts it after the actions bar and removes it when done.
 */
export function renderLibraryForm(
  sidebar: HTMLElement,
  onSaved: () => void,
): void {
  // Remove any existing form
  sidebar.querySelector('.reference-library-form')?.remove();

  const form = document.createElement('form');
  form.className = 'reference-library-form';

  for (const field of FIELDS) {
    form.appendChild(createField(field));
  }

  const doiInput = form.querySelector<HTMLInputElement>('[name="doi"]');
  if (doiInput) {
    const lookupBtn = document.createElement('button');
    lookupBtn.type = 'button';
    lookupBtn.className = 'reference-library-btn reference-library-btn--small';
    lookupBtn.textContent = 'Lookup DOI';
    lookupBtn.addEventListener('click', async () => {
      const doi = doiInput.value.trim();
      if (!doi) return;
      const data = await lookupDOI(doi);
      if (!data) return;
      fillForm(form, data);
    });
    doiInput.parentElement?.appendChild(lookupBtn);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'reference-library-form-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'reference-library-btn';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'reference-library-btn reference-library-btn--secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => form.remove());

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  form.appendChild(btnRow);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const authorsRaw = String(fd.get('authors') ?? '');
    const authors = authorsRaw
      ? authorsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const yearStr = String(fd.get('year') ?? '').trim();
    const year = yearStr ? Number(yearStr) : null;

    const body = {
      title: String(fd.get('title') ?? ''),
      authors,
      year,
      source: String(fd.get('source') ?? '') || null,
      doi: String(fd.get('doi') ?? '') || null,
      url: String(fd.get('url') ?? '') || null,
    };

    const res = await apiFetch('/api/references', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      form.remove();
      onSaved();
    }
  });

  // Insert after actions bar
  const actionsBar = sidebar.querySelector('.reference-library-actions');
  if (actionsBar?.nextSibling) {
    sidebar.insertBefore(form, actionsBar.nextSibling);
  } else {
    sidebar.appendChild(form);
  }
}

function fillForm(form: HTMLFormElement, data: Record<string, unknown>): void {
  const map: Record<string, string> = {
    title: String(data.title ?? ''),
    authors: Array.isArray(data.authors)
      ? data.authors.map((a: Record<string, string>) =>
          a.literal || [a.given, a.family].filter(Boolean).join(' ')
        ).join(', ')
      : '',
    year: data.issuedDate ? String(data.issuedDate).slice(0, 4) : '',
    source: String(data.containerTitle ?? data.publisher ?? ''),
    url: String(data.url ?? ''),
  };

  for (const [name, value] of Object.entries(map)) {
    const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (input && !input.value) input.value = value;
  }
}
