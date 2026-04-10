/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';

const RECENTLY_USED_KEY = 'opendesk:special-chars:recent';
const MAX_RECENT = 16;

interface CharEntry {
  char: string;
  name: string;
}

interface Category {
  label: string;
  chars: CharEntry[];
}

const CATEGORIES: Category[] = [
  {
    label: 'Math',
    chars: [
      { char: '±', name: 'plus-minus sign' },
      { char: '×', name: 'multiplication sign' },
      { char: '÷', name: 'division sign' },
      { char: '≠', name: 'not equal to' },
      { char: '≤', name: 'less-than or equal to' },
      { char: '≥', name: 'greater-than or equal to' },
      { char: '≈', name: 'almost equal to' },
      { char: '∞', name: 'infinity' },
      { char: '√', name: 'square root' },
      { char: '∑', name: 'n-ary summation' },
      { char: '∏', name: 'n-ary product' },
      { char: '∫', name: 'integral' },
      { char: '∂', name: 'partial differential' },
      { char: '∇', name: 'nabla' },
      { char: '°', name: 'degree sign' },
      { char: '‰', name: 'per mille sign' },
      { char: 'π', name: 'greek small letter pi' },
      { char: 'μ', name: 'micro sign' },
      { char: 'Ω', name: 'ohm sign' },
      { char: '∈', name: 'element of' },
      { char: '∉', name: 'not an element of' },
      { char: '∩', name: 'intersection' },
      { char: '∪', name: 'union' },
      { char: '⊂', name: 'subset of' },
    ],
  },
  {
    label: 'Arrows',
    chars: [
      { char: '←', name: 'leftwards arrow' },
      { char: '→', name: 'rightwards arrow' },
      { char: '↑', name: 'upwards arrow' },
      { char: '↓', name: 'downwards arrow' },
      { char: '↔', name: 'left right arrow' },
      { char: '↕', name: 'up down arrow' },
      { char: '⇐', name: 'leftwards double arrow' },
      { char: '⇒', name: 'rightwards double arrow' },
      { char: '⇑', name: 'upwards double arrow' },
      { char: '⇓', name: 'downwards double arrow' },
      { char: '⇔', name: 'left right double arrow' },
      { char: '↩', name: 'leftwards arrow with hook' },
      { char: '↪', name: 'rightwards arrow with hook' },
      { char: '↗', name: 'north east arrow' },
      { char: '↘', name: 'south east arrow' },
      { char: '↙', name: 'south west arrow' },
      { char: '↖', name: 'north west arrow' },
      { char: '↺', name: 'anticlockwise open circle arrow' },
      { char: '↻', name: 'clockwise open circle arrow' },
      { char: '⟵', name: 'long leftwards arrow' },
      { char: '⟶', name: 'long rightwards arrow' },
      { char: '⟷', name: 'long left right arrow' },
    ],
  },
  {
    label: 'Currency',
    chars: [
      { char: '$', name: 'dollar sign' },
      { char: '€', name: 'euro sign' },
      { char: '£', name: 'pound sign' },
      { char: '¥', name: 'yen sign' },
      { char: '¢', name: 'cent sign' },
      { char: '₹', name: 'indian rupee sign' },
      { char: '₽', name: 'ruble sign' },
      { char: '₩', name: 'won sign' },
      { char: '₪', name: 'new sheqel sign' },
      { char: '₺', name: 'turkish lira sign' },
      { char: '₿', name: 'bitcoin sign' },
      { char: '฿', name: 'thai baht sign' },
      { char: '₫', name: 'dong sign' },
      { char: '₭', name: 'kip sign' },
      { char: '₴', name: 'hryvnia sign' },
    ],
  },
  {
    label: 'Latin Extended',
    chars: [
      { char: 'À', name: 'latin capital letter a with grave' },
      { char: 'Á', name: 'latin capital letter a with acute' },
      { char: 'Â', name: 'latin capital letter a with circumflex' },
      { char: 'Ã', name: 'latin capital letter a with tilde' },
      { char: 'Ä', name: 'latin capital letter a with diaeresis' },
      { char: 'Å', name: 'latin capital letter a with ring above' },
      { char: 'Æ', name: 'latin capital letter ae' },
      { char: 'Ç', name: 'latin capital letter c with cedilla' },
      { char: 'È', name: 'latin capital letter e with grave' },
      { char: 'É', name: 'latin capital letter e with acute' },
      { char: 'Ê', name: 'latin capital letter e with circumflex' },
      { char: 'Ë', name: 'latin capital letter e with diaeresis' },
      { char: 'Ñ', name: 'latin capital letter n with tilde' },
      { char: 'Ö', name: 'latin capital letter o with diaeresis' },
      { char: 'Ø', name: 'latin capital letter o with stroke' },
      { char: 'Ü', name: 'latin capital letter u with diaeresis' },
      { char: 'ß', name: 'latin small letter sharp s' },
      { char: 'à', name: 'latin small letter a with grave' },
      { char: 'á', name: 'latin small letter a with acute' },
      { char: 'â', name: 'latin small letter a with circumflex' },
      { char: 'ä', name: 'latin small letter a with diaeresis' },
      { char: 'å', name: 'latin small letter a with ring above' },
      { char: 'æ', name: 'latin small letter ae' },
      { char: 'ç', name: 'latin small letter c with cedilla' },
    ],
  },
  {
    label: 'Punctuation',
    chars: [
      { char: '—', name: 'em dash' },
      { char: '–', name: 'en dash' },
      { char: '…', name: 'horizontal ellipsis' },
      { char: '·', name: 'middle dot' },
      { char: '•', name: 'bullet' },
      { char: '‣', name: 'triangular bullet' },
      { char: '′', name: 'prime' },
      { char: '″', name: 'double prime' },
      { char: '‹', name: 'single left-pointing angle quotation mark' },
      { char: '›', name: 'single right-pointing angle quotation mark' },
      { char: '«', name: 'left-pointing double angle quotation mark' },
      { char: '»', name: 'right-pointing double angle quotation mark' },
      { char: '"', name: 'left double quotation mark' },
      { char: '"', name: 'right double quotation mark' },
      { char: ''', name: 'left single quotation mark' },
      { char: ''', name: 'right single quotation mark' },
      { char: '†', name: 'dagger' },
      { char: '‡', name: 'double dagger' },
      { char: '§', name: 'section sign' },
      { char: '¶', name: 'pilcrow sign' },
      { char: '©', name: 'copyright sign' },
      { char: '®', name: 'registered sign' },
      { char: '™', name: 'trade mark sign' },
    ],
  },
  {
    label: 'Geometric',
    chars: [
      { char: '■', name: 'black square' },
      { char: '□', name: 'white square' },
      { char: '▲', name: 'black up-pointing triangle' },
      { char: '△', name: 'white up-pointing triangle' },
      { char: '▼', name: 'black down-pointing triangle' },
      { char: '▽', name: 'white down-pointing triangle' },
      { char: '◆', name: 'black diamond' },
      { char: '◇', name: 'white diamond' },
      { char: '●', name: 'black circle' },
      { char: '○', name: 'white circle' },
      { char: '★', name: 'black star' },
      { char: '☆', name: 'white star' },
      { char: '♠', name: 'black spade suit' },
      { char: '♣', name: 'black club suit' },
      { char: '♥', name: 'black heart suit' },
      { char: '♦', name: 'black diamond suit' },
      { char: '✓', name: 'check mark' },
      { char: '✗', name: 'ballot x' },
      { char: '✦', name: 'black four pointed star' },
      { char: '❖', name: 'black diamond minus white x' },
    ],
  },
];

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

  // Header
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

  // Search
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'special-chars-search';
  searchInput.placeholder = 'Search characters…';
  searchInput.setAttribute('aria-label', 'Search special characters');
  panel.appendChild(searchInput);

  // Body (scrollable)
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
      // Filter across all categories
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

    // Recent section
    if (recentEntries.length > 0) {
      body.appendChild(buildSection('Recently Used', recentEntries, insertChar));
    }

    // All categories
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
