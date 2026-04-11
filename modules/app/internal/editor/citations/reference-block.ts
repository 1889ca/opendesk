/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { apiFetch } from '../../shared/api-client.ts';
import type { ReferenceData } from './types.ts';
import { renderLibraryItem } from './library-item.ts';
import { renderLibraryForm } from './library-form.ts';
import type { PanelBlock } from '../panel-system.ts';

export function buildReferenceBlock(editor: Editor): PanelBlock {
  const content = document.createElement('div');
  content.className = 'reference-block';

  const actionsBar = document.createElement('div');
  actionsBar.className = 'reference-block-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'comment-action-btn';
  addBtn.textContent = 'Add';
  addBtn.addEventListener('click', () => renderLibraryForm(content, () => refresh()));

  const importBtn = document.createElement('button');
  importBtn.className = 'comment-action-btn';
  importBtn.textContent = 'Import';
  importBtn.addEventListener('click', () => triggerImport(() => refresh()));

  actionsBar.append(addBtn, importBtn);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'reference-block-search';
  searchInput.placeholder = 'Search references...';

  let currentQuery = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      currentQuery = searchInput.value.trim();
      refresh();
    }, 200);
  });

  const list = document.createElement('div');
  list.className = 'reference-block-list';

  content.append(actionsBar, searchInput, list);

  async function refresh() {
    const url = currentQuery
      ? `/api/references?q=${encodeURIComponent(currentQuery)}`
      : '/api/references';
    const res = await apiFetch(url);
    const refs: ReferenceData[] = res.ok ? await res.json() : [];

    list.innerHTML = '';
    if (refs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'reference-block-empty';
      empty.textContent = currentQuery ? 'No matching references' : 'No references yet';
      list.appendChild(empty);
      return;
    }
    for (const ref of refs) {
      list.appendChild(
        renderLibraryItem(ref, editor, {
          onDelete: async () => {
            await apiFetch(`/api/references/${encodeURIComponent(ref.id)}`, { method: 'DELETE' });
            refresh();
          },
          onEdit: () => refresh(),
        }),
      );
    }
  }

  refresh();

  return {
    id: 'references',
    title: 'References',
    content,
    cleanup: () => clearTimeout(timer),
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
