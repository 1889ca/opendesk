/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { apiFetch } from '../../shared/api-client.ts';
import type { ReferenceData } from './types.ts';
import { renderLibraryItem } from './library-item.ts';
import { renderLibraryForm } from './library-form.ts';

async function fetchLibraryRefs(query?: string): Promise<ReferenceData[]> {
  const url = query
    ? `/api/references?q=${encodeURIComponent(query)}`
    : '/api/references';
  const res = await apiFetch(url);
  if (!res.ok) return [];
  return res.json();
}

async function deleteRef(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/references/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.ok;
}

function buildHeader(
  sidebar: HTMLElement,
  onClose: () => void,
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'reference-library-header';

  const title = document.createElement('span');
  title.className = 'reference-library-title';
  title.textContent = 'Reference Library';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'reference-library-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.setAttribute('aria-label', 'Close reference library');
  closeBtn.addEventListener('click', onClose);

  header.appendChild(title);
  header.appendChild(closeBtn);
  return header;
}

function buildActions(onAdd: () => void, onImport: () => void): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'reference-library-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'reference-library-btn';
  addBtn.textContent = 'Add Reference';
  addBtn.addEventListener('click', onAdd);

  const importBtn = document.createElement('button');
  importBtn.className = 'reference-library-btn reference-library-btn--secondary';
  importBtn.textContent = 'Import';
  importBtn.addEventListener('click', onImport);

  bar.appendChild(addBtn);
  bar.appendChild(importBtn);
  return bar;
}

function buildSearchInput(onSearch: (q: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'reference-library-search';
  input.placeholder = 'Search references...';
  input.setAttribute('aria-label', 'Search references');

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => onSearch(input.value.trim()), 200);
  });
  return input;
}

/**
 * Build the reference library sidebar panel.
 * Returns { element, toggle, destroy } following the version-history pattern.
 */
export function buildReferenceLibrary(editor: Editor): {
  element: HTMLElement;
  toggle: (force?: boolean) => void;
  destroy: () => void;
} {
  const sidebar = document.createElement('aside');
  sidebar.className = 'reference-library';
  sidebar.setAttribute('aria-label', 'Reference Library');

  const listEl = document.createElement('div');
  listEl.className = 'reference-library-list';

  let currentQuery = '';

  async function refresh(): Promise<void> {
    const refs = await fetchLibraryRefs(currentQuery || undefined);
    listEl.innerHTML = '';
    if (refs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'reference-library-empty';
      empty.textContent = currentQuery ? 'No matching references' : 'No references yet';
      listEl.appendChild(empty);
      return;
    }
    for (const ref of refs) {
      listEl.appendChild(
        renderLibraryItem(ref, editor, {
          onDelete: async () => {
            await deleteRef(ref.id);
            refresh();
          },
          onEdit: () => refresh(),
        }),
      );
    }
  }

  function toggle(force?: boolean): void {
    const isOpen = force ?? !sidebar.classList.contains('reference-library-open');
    sidebar.classList.toggle('reference-library-open', isOpen);
    if (isOpen) refresh();
  }

  const header = buildHeader(sidebar, () => toggle(false));
  const actions = buildActions(
    () => renderLibraryForm(sidebar, () => refresh()),
    () => triggerImport(() => refresh()),
  );
  const searchInput = buildSearchInput((q) => {
    currentQuery = q;
    refresh();
  });

  sidebar.appendChild(header);
  sidebar.appendChild(actions);
  sidebar.appendChild(searchInput);
  sidebar.appendChild(listEl);

  return {
    element: sidebar,
    toggle,
    destroy: () => sidebar.remove(),
  };
}

function triggerImport(onDone: () => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.bib,.ris';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    const text = await file.text();
    const isBib = file.name.endsWith('.bib');
    const contentType = isBib ? 'application/x-bibtex' : 'application/x-ris';

    await apiFetch('/api/references/import', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: text,
    });

    input.remove();
    onDone();
  });

  input.click();
}
