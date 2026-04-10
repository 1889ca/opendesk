/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { CATEGORIES, type CharEntry } from './special-chars-data.ts';

const RECENTLY_USED_KEY = 'opendesk:special-chars:recent';
const MAX_RECENT = 16;

function loadRecent(): CharEntry[] {
  try {
    const raw = localStorage.getItem(RECENTLY_USED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CharEntry[];
  } catch {
    return [];
  }
}

function saveRecent(entries: CharEntry[]): void {
  try {
    localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
  } catch {
    // localStorage may be unavailable
  }
}

function addToRecent(entry: CharEntry): CharEntry[] {
  const current = loadRecent().filter((e) => e.char !== entry.char);
  current.unshift(entry);
  const trimmed = current.slice(0, MAX_RECENT);
  saveRecent(trimmed);
  return trimmed;
}

function buildCharTile(entry: CharEntry, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'special-chars-tile';
  btn.textContent = entry.char;
  btn.title = entry.name;
  btn.setAttribute('aria-label', entry.name);
  btn.addEventListener('click', onClick);
  return btn;
}

function buildSection(
  label: string, chars: CharEntry[], onInsert: (entry: CharEntry) => void
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'special-chars-section';

  const heading = document.createElement('h4');
  heading.className = 'special-chars-category';
  heading.textContent = label;
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'special-chars-grid';
  for (const entry of chars) {
    grid.appendChild(buildCharTile(entry, () => onInsert(entry)));
  }
  section.appendChild(grid);
  return section;
}

export function buildSpecialCharsPanel(editor: Editor): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'special-chars-panel';
  panel.setAttribute('aria-label', 'Special characters');
  panel.style.display = 'none';

  const header = document.createElement('div');
  header.className = 'special-chars-header';

  const title = document.createElement('h3');
  title.className = 'special-chars-title';
  title.textContent = 'Special Characters';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'special-chars-close';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close special characters panel');
  closeBtn.addEventListener('click', () => toggleSpecialCharsPanel(panel, false));
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'special-chars-search';
  searchInput.placeholder = 'Search characters…';
  searchInput.setAttribute('aria-label', 'Search special characters');
  panel.appendChild(searchInput);

  const body = document.createElement('div');
  body.className = 'special-chars-body';
  panel.appendChild(body);

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
        empty.className = 'special-chars-empty';
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
  return panel;
}

export function toggleSpecialCharsPanel(panel: HTMLElement, force?: boolean): void {
  const open = force !== undefined ? force : panel.style.display === 'none';
  panel.style.display = open ? '' : 'none';
  if (open) {
    const search = panel.querySelector<HTMLInputElement>('.special-chars-search');
    search?.focus();
  }
}
