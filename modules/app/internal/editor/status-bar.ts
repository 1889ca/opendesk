/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { calculateStats } from './doc-stats.ts';
import { t, onLocaleChange } from '../i18n/index.ts';

const DEBOUNCE_MS = 300;

function renderText(editor: Editor): string {
  const { document: doc, selection } = calculateStats(editor);

  if (selection) {
    return t('stats.selected', {
      selected: String(selection.words),
      total: String(doc.words),
    });
  }

  const readingTime = doc.readingTime
    ? t('stats.readingTime', { time: doc.readingTime })
    : t('stats.minRead');

  return [
    t(doc.words === 1 ? 'stats.word' : 'stats.words', { count: String(doc.words) }),
    readingTime,
  ].join('  \u00b7  ');
}

export function buildStatusBar(editor: Editor): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'status-bar';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');

  const statsSpan = document.createElement('span');
  statsSpan.className = 'status-bar__stats';
  bar.appendChild(statsSpan);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function update(): void {
    const text = renderText(editor);
    const { selection } = calculateStats(editor);
    statsSpan.textContent = text;
    statsSpan.classList.toggle('status-bar__stats--selection', selection !== null);
  }

  function scheduleUpdate(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(update, DEBOUNCE_MS);
  }

  editor.on('transaction', scheduleUpdate);
  onLocaleChange(() => update());

  // Initial render
  update();

  return bar;
}
