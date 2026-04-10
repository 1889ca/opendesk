/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange } from '../../i18n/index.ts';
import { searchPluginKey } from './search-extension.ts';
import type { SearchState } from './search-state.ts';
import {
  type PanelElements,
  createPanelElement,
  mountPanel,
  mountPanelInputs,
} from './search-panel-dom.ts';

/** Build and mount the floating search/replace panel. */
export function buildSearchPanel(editor: Editor): void {
  const panel = createPanelElement();
  const els = mountPanelInputs(panel);

  mountPanel(panel);
  bindPanelEvents(editor, panel, els);
  bindEditorEvents(editor, els);
}

function openPanel(
  panel: HTMLDivElement,
  els: PanelElements,
  showReplace = false,
): void {
  panel.style.display = 'flex';
  els.replaceRow.style.display = showReplace ? 'flex' : 'none';
  els.searchInput.focus();
  els.searchInput.select();
}

function closePanel(panel: HTMLDivElement, editor: Editor): void {
  panel.style.display = 'none';
  editor.commands.clearSearch();
  editor.commands.focus();
}

function bindPanelEvents(
  editor: Editor,
  panel: HTMLDivElement,
  els: PanelElements,
): void {
  document.addEventListener('opendesk:open-search', ((e: CustomEvent<{ showReplace?: boolean }>) => {
    openPanel(panel, els, e.detail?.showReplace ?? false);
  }) as EventListener);

  els.searchInput.addEventListener('input', () => {
    clearInputErrors(els.searchInput);
    editor.commands.find(els.searchInput.value);
  });

  els.nextBtn.addEventListener('click', () => editor.commands.findNext());
  els.prevBtn.addEventListener('click', () => editor.commands.findPrev());

  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.shiftKey ? editor.commands.findPrev() : editor.commands.findNext();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel(panel, editor);
    }
  });

  els.replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel(panel, editor);
    }
  });

  els.replaceBtn.addEventListener('click', () => {
    editor.commands.replaceMatch(els.replaceInput.value);
  });
  els.replaceAllBtn.addEventListener('click', () => {
    editor.commands.replaceAll(els.replaceInput.value);
  });

  bindToggles(editor, els);
  els.closeBtn.addEventListener('click', () => closePanel(panel, editor));

  onLocaleChange(() => {
    els.searchInput.placeholder = t('search.find');
    els.replaceInput.placeholder = t('search.replace');
    els.caseToggle.title = t('search.caseSensitive');
    els.regexToggle.title = t('search.useRegex');
    els.replaceBtn.textContent = t('search.replaceOne');
    els.replaceAllBtn.textContent = t('search.replaceAll');
  });
}

function bindToggles(editor: Editor, els: PanelElements): void {
  els.caseToggle.addEventListener('click', () => {
    const state = searchPluginKey.getState(editor.state) as SearchState;
    const next = !state?.caseSensitive;
    els.caseToggle.classList.toggle('is-active', next);
    editor.commands.setSearchOption('caseSensitive', next);
    if (els.searchInput.value) editor.commands.find(els.searchInput.value);
  });

  els.regexToggle.addEventListener('click', () => {
    const state = searchPluginKey.getState(editor.state) as SearchState;
    const next = !state?.useRegex;
    els.regexToggle.classList.toggle('is-active', next);
    editor.commands.setSearchOption('useRegex', next);
    if (els.searchInput.value) editor.commands.find(els.searchInput.value);
  });
}

function bindEditorEvents(editor: Editor, els: PanelElements): void {
  document.addEventListener('opendesk:search-update', ((
    e: CustomEvent<{ totalMatches: number; currentMatchIndex: number }>,
  ) => {
    const { totalMatches, currentMatchIndex } = e.detail;
    const hasQuery = Boolean(els.searchInput.value);
    const noResults = hasQuery && totalMatches === 0;
    els.searchInput.classList.toggle('is-no-results', noResults);
    if (totalMatches === 0) {
      els.counter.textContent = hasQuery ? t('search.noMatches') : '';
    } else {
      els.counter.textContent = t('search.matchCount', {
        current: currentMatchIndex + 1,
        total: totalMatches,
      });
    }
  }) as EventListener);

  document.addEventListener('opendesk:search-invalid-regex', (() => {
    els.searchInput.classList.add('is-invalid');
    els.counter.textContent = '';
  }) as EventListener);

  editor.on('transaction', () => {
    const state = searchPluginKey.getState(editor.state) as SearchState;
    if (!state?.searchTerm) {
      els.counter.textContent = '';
      els.searchInput.classList.remove('is-no-results', 'is-invalid');
    }
  });
}

function clearInputErrors(input: HTMLInputElement): void {
  input.classList.remove('is-invalid', 'is-no-results');
}
