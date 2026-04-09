/** Contract: contracts/app/rules.md */

/**
 * KB data loaders: fetch citations, entities, and datasets from the API.
 * Used by the KB picker to populate item lists.
 */

import { apiFetch } from '../shared/api-client.ts';
import type { ReferenceData } from '../editor/citations/types.ts';
import { formatInlineCitation } from '../editor/citations/citation-render.ts';
import type { KbPickerMode, KbInsertResult } from './kb-picker.ts';

type InsertCallback = (result: KbInsertResult) => void;

/** Load items for the given mode into the list element */
export async function loadItems(
  list: HTMLElement,
  mode: KbPickerMode,
  onInsert: InsertCallback,
  closePicker: () => void,
  query?: string,
): Promise<void> {
  list.innerHTML = '';
  if (mode === 'citation') {
    await loadCitations(list, onInsert, closePicker, query);
  } else if (mode === 'entity') {
    await loadEntities(list, onInsert, closePicker, query);
  } else {
    await loadDatasets(list, onInsert, closePicker, query);
  }
}

async function fetchRefs(query?: string): Promise<ReferenceData[]> {
  const url = query ? `/api/references?q=${encodeURIComponent(query)}` : '/api/references';
  const res = await apiFetch(url);
  if (!res.ok) return [];
  return res.json();
}

async function loadCitations(
  list: HTMLElement,
  onInsert: InsertCallback,
  closePicker: () => void,
  query?: string,
): Promise<void> {
  const refs = await fetchRefs(query);
  if (refs.length === 0) { showEmpty(list, 'No references found'); return; }

  for (const ref of refs) {
    list.appendChild(createItem(
      ref.title,
      formatInlineCitation(ref),
      () => {
        closePicker();
        onInsert({ mode: 'citation', id: ref.id, content: formatInlineCitation(ref), type: ref.type });
      },
    ));
  }
}

async function loadEntities(
  list: HTMLElement,
  onInsert: InsertCallback,
  closePicker: () => void,
  query?: string,
): Promise<void> {
  const refs = await fetchRefs(query);
  const entities = refs.filter((r) =>
    ['personal-communication', 'interview', 'software', 'other'].includes(r.type),
  );
  if (entities.length === 0) { showEmpty(list, 'No entities found'); return; }

  for (const ent of entities) {
    list.appendChild(createItem(
      ent.title,
      ent.type,
      () => {
        closePicker();
        onInsert({ mode: 'entity', id: ent.id, content: ent.title, type: ent.type });
      },
    ));
  }
}

async function loadDatasets(
  list: HTMLElement,
  onInsert: InsertCallback,
  closePicker: () => void,
  query?: string,
): Promise<void> {
  const refs = await fetchRefs(query);
  const datasets = refs.filter((r) => r.type === 'dataset');
  if (datasets.length === 0) { showEmpty(list, 'No datasets found'); return; }

  for (const ds of datasets) {
    list.appendChild(createItem(
      ds.title,
      'Dataset',
      () => {
        closePicker();
        onInsert({
          mode: 'dataset',
          id: ds.id,
          content: ds.title,
          type: 'dataset',
          updatedAt: ds.issuedDate || undefined,
        });
      },
    ));
  }
}

function createItem(
  titleText: string,
  metaText: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'kb-picker__item';
  btn.setAttribute('role', 'option');

  const title = document.createElement('span');
  title.className = 'kb-picker__title';
  title.textContent = titleText;

  const meta = document.createElement('span');
  meta.className = 'kb-picker__meta';
  meta.textContent = metaText;

  btn.appendChild(title);
  btn.appendChild(meta);
  btn.addEventListener('click', onClick);
  return btn;
}

function showEmpty(list: HTMLElement, msg: string): void {
  const el = document.createElement('div');
  el.className = 'kb-picker__empty';
  el.textContent = msg;
  list.appendChild(el);
}
