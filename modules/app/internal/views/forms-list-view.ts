/** Contract: contracts/app/rules.md */

/**
 * Forms list view — mounted at /forms in the SPA shell.
 *
 * Shows the user's forms with links to the builder and respondent page.
 * Pure DOM, no framework.
 */

import type { FormDefinition } from '../../../forms/contract.ts';

async function loadForms(): Promise<FormDefinition[]> {
  const res = await fetch('/api/forms', { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data ?? []);
}

async function createNewForm(): Promise<FormDefinition> {
  const res = await fetch('/api/forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title: 'Untitled Form', questions: [] }),
  });
  if (!res.ok) throw new Error('Failed to create form');
  return res.json() as Promise<FormDefinition>;
}

let container: HTMLElement | null = null;

async function render(root: HTMLElement): Promise<void> {
  root.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'forms-list-view';
  wrapper.style.cssText = 'max-width:900px;margin:0 auto;padding:2rem 1rem;';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;';

  const title = document.createElement('h1');
  title.style.cssText = 'font-size:1.5rem;font-weight:700;';
  title.textContent = 'Forms';

  const newBtn = document.createElement('button');
  newBtn.style.cssText = `
    background: var(--color-primary, #0d6efd);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  `;
  newBtn.textContent = 'New Form';
  newBtn.addEventListener('click', async () => {
    newBtn.disabled = true;
    newBtn.textContent = 'Creating…';
    try {
      const form = await createNewForm();
      window.location.href = `/form-builder/${encodeURIComponent(form.id)}`;
    } catch (err) {
      console.error('Failed to create form:', err);
      newBtn.disabled = false;
      newBtn.textContent = 'New Form';
    }
  });

  header.appendChild(title);
  header.appendChild(newBtn);
  wrapper.appendChild(header);

  // Form list
  const listEl = document.createElement('div');
  listEl.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem;';
  wrapper.appendChild(listEl);

  root.appendChild(wrapper);

  // Load and render forms
  try {
    const forms = await loadForms();

    if (forms.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        background: var(--color-bg, #fff);
        border-radius: 8px;
        padding: 3rem 2rem;
        text-align: center;
        color: var(--color-muted, #6c757d);
        border: 1px dashed var(--color-border, #e2e6ea);
      `;
      empty.innerHTML = '<p style="font-size:1rem;">No forms yet. Create your first form!</p>';
      listEl.appendChild(empty);
      return;
    }

    for (const form of forms) {
      listEl.appendChild(renderFormRow(form));
    }
  } catch (err) {
    const errEl = document.createElement('div');
    errEl.style.cssText = 'color:var(--color-danger,#dc3545);padding:1rem;';
    errEl.textContent = 'Failed to load forms.';
    listEl.appendChild(errEl);
    console.error('Forms list load error:', err);
  }
}

function renderFormRow(form: FormDefinition): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = `
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--color-bg, #fff);
    border: 1px solid var(--color-border, #e2e6ea);
    border-radius: 8px;
    padding: 1rem 1.25rem;
  `;

  const info = document.createElement('div');
  info.style.flex = '1';

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-size:0.9375rem;font-weight:600;';
  titleEl.textContent = form.title || 'Untitled Form';

  const meta = document.createElement('div');
  meta.style.cssText = 'font-size:0.8125rem;color:var(--color-muted,#6c757d);margin-top:2px;';
  const qCount = form.questions?.length ?? 0;
  meta.textContent = `${qCount} question${qCount !== 1 ? 's' : ''} · Updated ${new Date(form.updated_at).toLocaleDateString()}`;

  info.appendChild(titleEl);
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:0.5rem;';

  const editBtn = document.createElement('a');
  editBtn.href = `/form-builder/${encodeURIComponent(form.id)}`;
  editBtn.textContent = 'Edit';
  editBtn.style.cssText = `
    padding: 0.375rem 0.875rem;
    border: 1px solid var(--color-border,#e2e6ea);
    border-radius: 6px;
    font-size: 0.875rem;
    text-decoration: none;
    color: var(--color-text,#212529);
    background: var(--color-bg,#fff);
  `;

  const viewBtn = document.createElement('a');
  viewBtn.href = `/f/${encodeURIComponent(form.id)}`;
  viewBtn.target = '_blank';
  viewBtn.rel = 'noopener noreferrer';
  viewBtn.textContent = 'View form';
  viewBtn.style.cssText = `
    padding: 0.375rem 0.875rem;
    border-radius: 6px;
    font-size: 0.875rem;
    text-decoration: none;
    color: #fff;
    background: var(--color-primary,#0d6efd);
    border: 1px solid transparent;
  `;

  actions.appendChild(editBtn);
  actions.appendChild(viewBtn);

  row.appendChild(info);
  row.appendChild(actions);

  return row;
}

export async function mount(root: HTMLElement, _params: Record<string, string>): Promise<void> {
  container = root;
  await render(root);
}

export function unmount(): void {
  if (container) container.innerHTML = '';
  container = null;
}
