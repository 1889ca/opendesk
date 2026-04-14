/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { CATEGORIES, type CharEntry } from './special-chars-data.ts';
import type { PanelBlock } from './panel-system.ts';

const RECENTLY_USED_KEY = 'opendesk:special-chars:recent';
const MAX_RECENT = 16;

export function buildSpecialCharsBlock(editor: Editor): PanelBlock {
  const content = document.createElement('div');
  content.className = 'special-chars-block';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'special-chars-block-search';
  searchInput.placeholder = 'Search characters\u2026';

  const body = document.createElement('div');
  body.className = 'special-chars-block-body';

  content.append(searchInput, body);

  let currentQuery = '';
  let recentEntries = loadRecent();

  function insertChar(entry: CharEntry): void {
    editor.chain().focus().insertContent(entry.char).run();
    recentEntries = addToRecent(entry);
    renderContent();
  }

  function renderContent(): void {
    body.innerHTML = '';
    const query = currentQuery.trim().toLowerCase();

    if (query) {
      const matches: CharEntry[] = [];
      for (const cat of CATEGORIES) {
        for (const entry of cat.chars) {
          if (entry.name.includes(query) || entry.char.includes(query)) {
            matches.push(entry);
          }
        }
      }
      if (matches.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'special-chars-block-empty';
        empty.textContent = 'No characters found.';
        body.appendChild(empty);
      } else {
        body.appendChild(buildSection('Results', matches, insertChar));
      }
      return;
    }

    if (recentEntries.length > 0) {
      body.appendChild(buildSection('Recently Used', recentEntries, insertChar));
    }
    for (const cat of CATEGORIES) {
      body.appendChild(buildSection(cat.label, cat.chars, insertChar));
    }
  }

  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    renderContent();
  });

  renderContent();

  return {
    id: 'special-chars',
    title: 'Special Characters',
    icon: '\u03A9',
    content,
  };
}

function buildSection(label: string, chars: CharEntry[], onInsert: (e: CharEntry) => void): HTMLElement {
  const section = document.createElement('div');
  section.className = 'special-chars-section';

  const heading = document.createElement('h4');
  heading.className = 'special-chars-category';
  heading.textContent = label;
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'special-chars-grid';
  for (const entry of chars) {
    const btn = document.createElement('button');
    btn.className = 'special-chars-tile';
    btn.textContent = entry.char;
    btn.title = entry.name;
    btn.addEventListener('click', () => onInsert(entry));
    grid.appendChild(btn);
  }
  section.appendChild(grid);
  return section;
}

function loadRecent(): CharEntry[] {
  try {
    const raw = localStorage.getItem(RECENTLY_USED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addToRecent(entry: CharEntry): CharEntry[] {
  const current = loadRecent().filter((e) => e.char !== entry.char);
  current.unshift(entry);
  const trimmed = current.slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify(trimmed)); } catch { /* localStorage unavailable */ }
  return trimmed;
}
