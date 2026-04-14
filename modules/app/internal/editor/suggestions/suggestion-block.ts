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
import type { PanelBlock } from '../panel-system.ts';

export function buildSuggestionsBlock(editor: Editor): PanelBlock {
  const content = document.createElement('div');
  content.className = 'suggestions-block';

  const bulkBar = document.createElement('div');
  bulkBar.className = 'suggestions-block-bulk';

  const acceptAllBtn = document.createElement('button');
  acceptAllBtn.className = 'comment-action-btn';
  acceptAllBtn.textContent = t('suggestions.acceptAll');
  acceptAllBtn.addEventListener('click', () => acceptAllSuggestions(editor));

  const rejectAllBtn = document.createElement('button');
  rejectAllBtn.className = 'comment-action-btn';
  rejectAllBtn.textContent = t('suggestions.rejectAll');
  rejectAllBtn.addEventListener('click', () => rejectAllSuggestions(editor));

  bulkBar.append(acceptAllBtn, rejectAllBtn);

  const list = document.createElement('div');
  list.className = 'suggestions-block-list';

  content.append(bulkBar, list);

  const render = () => {
    list.innerHTML = '';
    acceptAllBtn.textContent = t('suggestions.acceptAll');
    rejectAllBtn.textContent = t('suggestions.rejectAll');

    const suggestions = collectSuggestions(editor);

    if (suggestions.length === 0) {
      bulkBar.style.display = 'none';
      const empty = document.createElement('p');
      empty.className = 'suggestions-block-empty';
      empty.textContent = t('suggestions.none');
      list.appendChild(empty);
      return;
    }

    bulkBar.style.display = 'flex';
    for (const s of suggestions) {
      list.appendChild(renderCard(editor, s));
    }
  };

  render();

  const onTx = ({ transaction }: { transaction: { docChanged: boolean } }) => {
    if (transaction.docChanged) render();
  };
  editor.on('transaction', onTx);

  const unsubLocale = onLocaleChange(render);

  return {
    id: 'suggestions',
    title: t('suggestions.title'),
    icon: '\u2713',
    content,
    cleanup: () => {
      editor.off('transaction', onTx);
      unsubLocale();
    },
  };
}

function renderCard(editor: Editor, entry: SuggestionEntry): HTMLElement {
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

  meta.append(dot, author);
  card.appendChild(meta);

  const text = document.createElement('div');
  text.className = 'suggestion-card-text';
  const label = entry.type === 'insert'
    ? t('suggestions.inserted')
    : t('suggestions.deleted');
  text.textContent = `${label}: "${truncate(entry.text, 50)}"`;
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

  actions.append(acceptBtn, rejectBtn);
  card.appendChild(actions);

  card.addEventListener('click', () => {
    editor.chain().focus().setTextSelection(entry.from).run();
  });

  return card;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '\u2026' : str;
}
