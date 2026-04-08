/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import type { ReferenceData } from './types.ts';
import { formatInlineCitation } from './citation-render.ts';

export type LibraryItemCallbacks = {
  onDelete: () => void;
  onEdit: () => void;
};

function formatAuthors(ref: ReferenceData): string {
  if (!ref.authors || ref.authors.length === 0) return '';
  return ref.authors
    .map((a) => a.literal || [a.family, a.given].filter(Boolean).join(', '))
    .join('; ');
}

function extractYear(ref: ReferenceData): string {
  if (!ref.issuedDate) return '';
  return ref.issuedDate.slice(0, 4);
}

function typeBadge(type: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'reference-library-badge';
  badge.textContent = type.replace(/-/g, ' ');
  return badge;
}

/**
 * Render a single reference library item card.
 */
export function renderLibraryItem(
  ref: ReferenceData,
  editor: Editor,
  callbacks: LibraryItemCallbacks,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'reference-library-item';
  card.dataset.refId = ref.id;

  const titleRow = document.createElement('div');
  titleRow.className = 'reference-library-item-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'reference-library-item-title';
  titleEl.textContent = ref.title;

  const year = extractYear(ref);
  const yearEl = document.createElement('span');
  yearEl.className = 'reference-library-item-year';
  yearEl.textContent = year;

  titleRow.appendChild(titleEl);
  if (year) titleRow.appendChild(yearEl);

  const metaRow = document.createElement('div');
  metaRow.className = 'reference-library-item-meta';

  const authorsText = formatAuthors(ref);
  if (authorsText) {
    const authorsEl = document.createElement('span');
    authorsEl.textContent = authorsText;
    metaRow.appendChild(authorsEl);
  }
  metaRow.appendChild(typeBadge(ref.type));

  const actionsRow = document.createElement('div');
  actionsRow.className = 'reference-library-item-actions';

  const insertBtn = document.createElement('button');
  insertBtn.className = 'reference-library-action-btn';
  insertBtn.textContent = 'Cite';
  insertBtn.addEventListener('click', () => {
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
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'reference-library-action-btn reference-library-action-delete';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    if (confirm('Delete this reference?')) callbacks.onDelete();
  });

  actionsRow.appendChild(insertBtn);
  actionsRow.appendChild(deleteBtn);

  card.appendChild(titleRow);
  card.appendChild(metaRow);
  card.appendChild(actionsRow);
  return card;
}
