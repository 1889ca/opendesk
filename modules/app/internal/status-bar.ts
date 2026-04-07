/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { calculateStats } from './doc-stats.ts';
import { t, onLocaleChange } from './i18n/index.ts';

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
    t('stats.words', { count: String(doc.words) }),
    t('stats.characters', { count: String(doc.characters) }),
    t('stats.paragraphs', { count: String(doc.paragraphs) }),
    readingTime,
  ].join(' \u00b7 ');
}

export function buildStatusBar(editor: Editor): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'status-bar';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function update(): void {
    bar.textContent = renderText(editor);
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
