/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import type { ReferenceData } from './types.ts';
import { formatInlineCitation } from './citation-render.ts';
import { apiFetch } from '../../shared/api-client.ts';

let activePicker: HTMLElement | null = null;
let cleanupFn: (() => void) | null = null;

/** Close any open citation picker. */
export function closeCitationPicker(): void {
  if (activePicker) {
    activePicker.remove();
    activePicker = null;
  }
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

/** Fetch references from the API, with optional search query. */
async function fetchReferences(query?: string): Promise<ReferenceData[]> {
  const url = query
    ? `/api/references?q=${encodeURIComponent(query)}`
    : '/api/references';
  const res = await apiFetch(url);
  if (!res.ok) return [];
  return res.json();
}

/** Open the citation picker near the given anchor element. */
export function openCitationPicker(editor: Editor, anchor: HTMLElement): void {
  closeCitationPicker();

  const panel = document.createElement('div');
  panel.className = 'citation-picker';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Insert citation');

  const searchInput = buildSearchInput(panel, editor);
  const list = document.createElement('div');
  list.className = 'citation-picker__list';
  list.setAttribute('role', 'listbox');
  panel.appendChild(list);

  positionPicker(panel, anchor);
  document.body.appendChild(panel);
  activePicker = panel;
  searchInput.focus();

  loadReferences(list, editor);

  const onClickOutside = (e: MouseEvent) => {
    if (!panel.contains(e.target as Node) && e.target !== anchor) {
      closeCitationPicker();
    }
  };
  const onEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeCitationPicker();
      editor.commands.focus();
    }
  };

  setTimeout(() => document.addEventListener('click', onClickOutside), 0);
  document.addEventListener('keydown', onEscape);
  cleanupFn = () => {
    document.removeEventListener('click', onClickOutside);
    document.removeEventListener('keydown', onEscape);
  };
}

function buildSearchInput(panel: HTMLElement, editor: Editor): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'citation-picker__search';
  input.placeholder = 'Search references...';
  input.setAttribute('aria-label', 'Search references');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const list = panel.querySelector('.citation-picker__list') as HTMLElement;
      if (!list) return;
      const query = input.value.trim();
      loadReferences(list, editor, query || undefined);
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateList(panel, e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectActive(panel);
    }
  });

  panel.appendChild(input);
  return input;
}

async function loadReferences(
  list: HTMLElement, editor: Editor, query?: string,
): Promise<void> {
  list.innerHTML = '';
  const refs = await fetchReferences(query);
  if (refs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'citation-picker__empty';
    empty.textContent = 'No references found';
    list.appendChild(empty);
    return;
  }
  for (const ref of refs) {
    list.appendChild(createRefItem(ref, editor));
  }
}

function createRefItem(ref: ReferenceData, editor: Editor): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'citation-picker__item';
  btn.setAttribute('role', 'option');
  btn.dataset.refId = ref.id;

  const title = document.createElement('span');
  title.className = 'citation-picker__title';
  title.textContent = ref.title;

  const meta = document.createElement('span');
  meta.className = 'citation-picker__meta';
  meta.textContent = formatInlineCitation(ref);

  btn.appendChild(title);
  btn.appendChild(meta);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    insertCitation(editor, ref);
    closeCitationPicker();
  });
  return btn;
}

function insertCitation(editor: Editor, ref: ReferenceData): void {
  const inlineText = formatInlineCitation(ref);
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'text',
      text: inlineText,
      marks: [{ type: 'citation', attrs: { referenceId: ref.id } }],
    })
    .run();
}

function navigateList(panel: HTMLElement, direction: number): void {
  const items = Array.from(
    panel.querySelectorAll<HTMLElement>('.citation-picker__item'),
  );
  if (items.length === 0) return;
  const active = panel.querySelector('.citation-picker__item.is-selected');
  let idx = active ? items.indexOf(active as HTMLElement) + direction : 0;
  idx = Math.max(0, Math.min(items.length - 1, idx));
  items.forEach((el) => el.classList.remove('is-selected'));
  items[idx].classList.add('is-selected');
  items[idx].scrollIntoView({ block: 'nearest' });
}

function selectActive(panel: HTMLElement): void {
  const active = panel.querySelector<HTMLButtonElement>(
    '.citation-picker__item.is-selected',
  );
  if (active) active.click();
}

function positionPicker(panel: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  panel.style.position = 'fixed';
  panel.style.top = `${rect.bottom + 4}px`;
  panel.style.left = `${Math.max(8, rect.left)}px`;

  requestAnimationFrame(() => {
    const panelRect = panel.getBoundingClientRect();
    if (panelRect.right > window.innerWidth - 8) {
      panel.style.left = `${window.innerWidth - panelRect.width - 8}px`;
    }
  });
}
