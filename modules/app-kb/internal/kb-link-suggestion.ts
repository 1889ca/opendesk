/** Contract: contracts/app-kb/rules.md */

import { fetchEntries } from './kb-api.ts';
import { createKbLinkList } from './kb-link-list.ts';

const TRIGGER = '[[';

/** Extract the current `[[query` from cursor position if active. Returns null if not in a link trigger. */
function extractQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const triggerIdx = before.lastIndexOf(TRIGGER);
  if (triggerIdx === -1) return null;
  // Ensure no closing `]]` between trigger and cursor
  const segment = before.slice(triggerIdx + TRIGGER.length);
  if (segment.includes(']]') || segment.includes('\n')) return null;
  return segment;
}

/** Get pixel coordinates for the caret position within a textarea. */
function getCaretCoords(textarea: HTMLTextAreaElement): { left: number; bottom: number } {
  const rect = textarea.getBoundingClientRect();
  // Approximate: use textarea bottom-left as anchor
  return { left: rect.left + 8, bottom: rect.bottom };
}

/** Replace the `[[query` text at cursor with the completed link token `[[title|id]]`. */
function insertLink(textarea: HTMLTextAreaElement, query: string, title: string, id: string): void {
  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart === null) return;

  const before = value.slice(0, selectionStart);
  const triggerIdx = before.lastIndexOf(TRIGGER);
  if (triggerIdx === -1) return;

  const newBefore = before.slice(0, triggerIdx) + `[[${title}|${id}]]`;
  const after = value.slice(selectionEnd ?? selectionStart);
  textarea.value = newBefore + after;

  const newCursor = newBefore.length;
  textarea.setSelectionRange(newCursor, newCursor);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Attach `[[` inline link suggestion behaviour to a textarea element.
 * Returns a cleanup function that removes all listeners.
 */
export function attachKbLinkSuggestion(textarea: HTMLTextAreaElement): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const list = createKbLinkList((item) => {
    const query = extractQuery(textarea.value, textarea.selectionStart ?? 0);
    insertLink(textarea, query ?? '', item.title, item.id);
    list.hide();
    textarea.focus();
  });

  async function fetchAndShow(query: string): Promise<void> {
    try {
      const entries = await fetchEntries({ search: query || undefined, limit: 10 });
      const items = entries.map((e) => ({ id: e.id, title: e.title }));
      if (list.isVisible()) {
        list.update(items);
      } else {
        list.show(items, getCaretCoords(textarea));
      }
    } catch {
      list.hide();
    }
  }

  function onInput(): void {
    const pos = textarea.selectionStart ?? 0;
    const query = extractQuery(textarea.value, pos);
    if (query === null) {
      list.hide();
      return;
    }
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchAndShow(query), 180);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (list.isVisible()) {
      const handled = list.handleKey(e);
      if (handled) e.preventDefault();
    }
  }

  function onBlur(): void {
    // Slight delay so mousedown on dropdown fires first
    setTimeout(() => list.hide(), 150);
  }

  textarea.addEventListener('input', onInput);
  textarea.addEventListener('keydown', onKeyDown);
  textarea.addEventListener('blur', onBlur);

  return () => {
    textarea.removeEventListener('input', onInput);
    textarea.removeEventListener('keydown', onKeyDown);
    textarea.removeEventListener('blur', onBlur);
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    list.hide();
  };
}
