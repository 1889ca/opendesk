/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { calculateStats } from './doc-stats.ts';
import { t, onLocaleChange } from '../i18n/index.ts';
import { createScope, debounce } from './lifecycle.ts';

const DEBOUNCE_MS = 300;

function renderText(editor: Editor): string {
  const { document: doc, selection } = calculateStats(editor);

  if (selection) {
    return t('stats.selected', {
      selected: String(selection.words),
      total: String(doc.words),
    });
  }

  return [
    t(doc.words === 1 ? 'stats.word' : 'stats.words', { count: String(doc.words) }),
    t(doc.characters === 1 ? 'stats.character' : 'stats.characters', { count: String(doc.characters) }),
    t(doc.paragraphs === 1 ? 'stats.paragraph' : 'stats.paragraphs', { count: String(doc.paragraphs) }),
    t('stats.readingTime', { time: String(doc.readingTime) }),
  ].join('  \u00b7  ');
}

export function buildStatusBar(editor: Editor): { el: HTMLElement; cleanup: () => void } {
  const scope = createScope();
  const bar = document.createElement('div');
  bar.className = 'status-bar';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');

  const statsSpan = document.createElement('span');
  statsSpan.className = 'status-bar__stats';
  bar.appendChild(statsSpan);

  function update(): void {
    const text = renderText(editor);
    const { selection } = calculateStats(editor);
    statsSpan.textContent = text;
    statsSpan.classList.toggle('status-bar__stats--selection', selection !== null);
  }

  const debouncedUpdate = debounce(update, DEBOUNCE_MS);
  scope.add(debouncedUpdate.cancel);
  scope.onEditor(editor, 'transaction', debouncedUpdate.call);
  scope.add(onLocaleChange(() => update()));

  // Initial render
  update();

  return { el: bar, cleanup: scope.dispose };
}
