/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import {
  type EmojiCategory, EMOJI_CATEGORIES, CATEGORY_ICONS,
  getEmojisByCategory, searchEmojis,
} from './emoji-data.ts';
import { getRecentEmojis, addRecentEmoji } from './emoji-recent.ts';
import { t, type TranslationKey } from '../../i18n/index.ts';

let activePicker: HTMLElement | null = null;
let cleanupFn: (() => void) | null = null;

/** Close any open emoji picker. */
export function closeEmojiPicker(): void {
  if (activePicker) {
    activePicker.remove();
    activePicker = null;
  }
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

/** Open the emoji picker panel near the given anchor element. */
export function openEmojiPicker(editor: Editor, anchor: HTMLElement): void {
  closeEmojiPicker();

  const panel = document.createElement('div');
  panel.className = 'emoji-picker';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t('toolbar.emoji' as TranslationKey));

  const searchInput = buildSearchInput(panel, editor);
  buildCategoryTabs(panel, editor, searchInput);
  const grid = document.createElement('div');
  grid.className = 'emoji-picker__grid';
  panel.appendChild(grid);

  renderCategory(grid, editor, EMOJI_CATEGORIES[0]);
  showRecentSection(grid, editor);

  positionPicker(panel, anchor);
  document.body.appendChild(panel);
  activePicker = panel;
  searchInput.focus();

  const onClickOutside = (e: MouseEvent) => {
    if (!panel.contains(e.target as Node) && e.target !== anchor) {
      closeEmojiPicker();
    }
  };
  const onEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeEmojiPicker();
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
  input.className = 'emoji-picker__search';
  input.placeholder = t('emoji.search' as TranslationKey);
  input.setAttribute('aria-label', t('emoji.search' as TranslationKey));

  input.addEventListener('input', () => {
    const grid = panel.querySelector('.emoji-picker__grid');
    if (!grid) return;
    grid.innerHTML = '';
    const query = input.value.trim();
    if (query.length === 0) {
      renderCategory(grid as HTMLElement, editor, EMOJI_CATEGORIES[0]);
      showRecentSection(grid as HTMLElement, editor);
      return;
    }
    const results = searchEmojis(query);
    for (const entry of results) {
      grid.appendChild(createEmojiButton(entry.emoji, editor));
    }
    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'emoji-picker__empty';
      empty.textContent = t('search.noMatches' as TranslationKey);
      grid.appendChild(empty);
    }
  });

  panel.appendChild(input);
  return input;
}

function buildCategoryTabs(
  panel: HTMLElement, editor: Editor, searchInput: HTMLInputElement,
): HTMLElement {
  const tabs = document.createElement('div');
  tabs.className = 'emoji-picker__tabs';
  tabs.setAttribute('role', 'tablist');

  for (const cat of EMOJI_CATEGORIES) {
    const btn = document.createElement('button');
    btn.className = 'emoji-picker__tab';
    btn.textContent = CATEGORY_ICONS[cat];
    btn.title = t(`emoji.${cat}` as TranslationKey);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', cat === EMOJI_CATEGORIES[0] ? 'true' : 'false');

    btn.addEventListener('click', () => {
      searchInput.value = '';
      tabs.querySelectorAll('.emoji-picker__tab').forEach((el) =>
        el.setAttribute('aria-selected', 'false'),
      );
      btn.setAttribute('aria-selected', 'true');

      const grid = panel.querySelector('.emoji-picker__grid');
      if (!grid) return;
      grid.innerHTML = '';
      renderCategory(grid as HTMLElement, editor, cat);
    });
    tabs.appendChild(btn);
  }

  panel.appendChild(tabs);
  return tabs;
}

function renderCategory(grid: HTMLElement, editor: Editor, category: EmojiCategory): void {
  const emojis = getEmojisByCategory(category);
  for (const entry of emojis) {
    grid.appendChild(createEmojiButton(entry.emoji, editor));
  }
}

function showRecentSection(grid: HTMLElement, editor: Editor): void {
  const recent = getRecentEmojis();
  if (recent.length === 0) return;

  const label = document.createElement('div');
  label.className = 'emoji-picker__section-label';
  label.textContent = t('emoji.recent' as TranslationKey);

  grid.insertBefore(label, grid.firstChild);

  const recentGrid = document.createElement('div');
  recentGrid.className = 'emoji-picker__recent-grid';
  for (const emoji of recent) {
    recentGrid.appendChild(createEmojiButton(emoji, editor));
  }
  if (label.nextSibling) {
    grid.insertBefore(recentGrid, label.nextSibling);
  } else {
    grid.appendChild(recentGrid);
  }
}

function createEmojiButton(emoji: string, editor: Editor): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'emoji-picker__emoji';
  btn.textContent = emoji;
  btn.type = 'button';
  btn.setAttribute('aria-label', emoji);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    insertEmoji(editor, emoji);
    closeEmojiPicker();
  });
  return btn;
}

function insertEmoji(editor: Editor, emoji: string): void {
  addRecentEmoji(emoji);
  editor.chain().focus().insertContent(emoji).run();
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
