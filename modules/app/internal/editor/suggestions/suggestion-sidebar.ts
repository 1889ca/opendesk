/** Contract: contracts/app/suggestions.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange } from '../../i18n/index.ts';
import {
  collectSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  acceptAllSuggestions,
  rejectAllSuggestions,
} from './suggestion-actions.ts';
import type { SuggestionEntry } from './types.ts';

/**
 * Build the suggestion sidebar that lists all pending suggestions.
 */
export function buildSuggestionSidebar(editor: Editor): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'suggestion-sidebar';
  sidebar.setAttribute('aria-label', t('suggestions.sidebarLabel'));

  const header = document.createElement('div');
  header.className = 'suggestion-sidebar-header';

  const title = document.createElement('h2');
  title.className = 'suggestion-sidebar-title';
  title.textContent = t('suggestions.title');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'suggestion-sidebar-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', () => toggleSuggestionSidebar(sidebar, false));

  header.appendChild(title);
  header.appendChild(closeBtn);
  sidebar.appendChild(header);

  const bulkBar = document.createElement('div');
  bulkBar.className = 'suggestion-bulk-actions';

  const acceptAllBtn = document.createElement('button');
  acceptAllBtn.className = 'suggestion-bulk-btn suggestion-bulk-accept';
  acceptAllBtn.textContent = t('suggestions.acceptAll');
  acceptAllBtn.addEventListener('click', () => acceptAllSuggestions(editor));

  const rejectAllBtn = document.createElement('button');
  rejectAllBtn.className = 'suggestion-bulk-btn suggestion-bulk-reject';
  rejectAllBtn.textContent = t('suggestions.rejectAll');
  rejectAllBtn.addEventListener('click', () => rejectAllSuggestions(editor));

  bulkBar.appendChild(acceptAllBtn);
  bulkBar.appendChild(rejectAllBtn);
  sidebar.appendChild(bulkBar);

  const list = document.createElement('div');
  list.className = 'suggestion-sidebar-list';
  sidebar.appendChild(list);

  const render = () => {
    list.innerHTML = '';
    title.textContent = t('suggestions.title');
    acceptAllBtn.textContent = t('suggestions.acceptAll');
    rejectAllBtn.textContent = t('suggestions.rejectAll');

    const suggestions = collectSuggestions(editor);

    if (suggestions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'suggestion-sidebar-empty';
      empty.textContent = t('suggestions.none');
      list.appendChild(empty);
      bulkBar.style.display = 'none';
      return;
    }

    bulkBar.style.display = 'flex';
    for (const s of suggestions) {
      list.appendChild(renderSuggestionCard(editor, s));
    }
  };

  render();
  editor.on('transaction', ({ transaction }) => {
    if (transaction.docChanged) render();
  });
  onLocaleChange(render);

  return sidebar;
}

/** Toggle the suggestion sidebar visibility. */
export function toggleSuggestionSidebar(
  sidebar: HTMLElement,
  show?: boolean,
): void {
  const visible =
    show ?? !sidebar.classList.contains('suggestion-sidebar-open');
  sidebar.classList.toggle('suggestion-sidebar-open', visible);
}

function renderSuggestionCard(
  editor: Editor,
  entry: SuggestionEntry,
): HTMLElement {
  const card = document.createElement('div');
  card.className = `suggestion-card suggestion-card-${entry.type}`;

  const meta = document.createElement('div');
  meta.className = 'suggestion-card-meta';

  const dot = document.createElement('span');
  dot.className = 'suggestion-card-dot';
  dot.style.background = entry.authorColor;

  const author = document.createElement('span');
  author.className = 'suggestion-card-author';
  author.textContent = entry.authorName;

  meta.appendChild(dot);
  meta.appendChild(author);
  card.appendChild(meta);

  const text = document.createElement('div');
  text.className = 'suggestion-card-text';
  const label = entry.type === 'insert'
    ? t('suggestions.inserted')
    : t('suggestions.deleted');
  text.textContent = `${label}: "${truncate(entry.text, 60)}"`;
  card.appendChild(text);

  const actions = document.createElement('div');
  actions.className = 'suggestion-card-actions';

  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'comment-action-btn';
  acceptBtn.textContent = t('suggestions.accept');
  acceptBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    acceptSuggestion(editor, entry.id);
  });

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'comment-action-btn';
  rejectBtn.textContent = t('suggestions.reject');
  rejectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    rejectSuggestion(editor, entry.id);
  });

  actions.appendChild(acceptBtn);
  actions.appendChild(rejectBtn);
  card.appendChild(actions);

  card.addEventListener('click', () => {
    editor.chain().focus().setTextSelection(entry.from).run();
  });

  return card;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '\u2026' : str;
}
