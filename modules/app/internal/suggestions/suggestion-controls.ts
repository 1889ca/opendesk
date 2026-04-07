/** Contract: contracts/app/suggestions.md */
import type { Editor } from '@tiptap/core';
import { t } from '../i18n/index.ts';
import { acceptSuggestion, rejectSuggestion } from './suggestion-actions.ts';
import { formatRelativeTime } from '../time-format.ts';

let activePopover: HTMLElement | null = null;

/** Remove any visible suggestion popover. */
export function dismissSuggestionPopover(): void {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

/**
 * Show a floating accept/reject toolbar near the clicked suggestion mark.
 */
export function showSuggestionPopover(
  editor: Editor,
  target: HTMLElement,
): void {
  dismissSuggestionPopover();

  const suggestionId =
    target.closest<HTMLElement>('[data-suggestion-id]')
      ?.getAttribute('data-suggestion-id');
  if (!suggestionId) return;

  const authorName =
    target.closest<HTMLElement>('[data-author-name]')
      ?.getAttribute('data-author-name') ?? '';
  const createdAt =
    target.closest<HTMLElement>('[data-created-at]')
      ?.getAttribute('data-created-at') ?? '';

  const popover = document.createElement('div');
  popover.className = 'suggestion-popover';

  const meta = document.createElement('div');
  meta.className = 'suggestion-popover-meta';
  const timeStr = createdAt ? formatTime(createdAt) : '';
  meta.textContent = authorName + (timeStr ? ` \u00b7 ${timeStr}` : '');
  popover.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'suggestion-popover-actions';

  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'suggestion-popover-btn suggestion-popover-accept';
  acceptBtn.textContent = t('suggestions.accept');
  acceptBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    acceptSuggestion(editor, suggestionId);
    dismissSuggestionPopover();
  });

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'suggestion-popover-btn suggestion-popover-reject';
  rejectBtn.textContent = t('suggestions.reject');
  rejectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    rejectSuggestion(editor, suggestionId);
    dismissSuggestionPopover();
  });

  actions.appendChild(acceptBtn);
  actions.appendChild(rejectBtn);
  popover.appendChild(actions);

  const rect = target.getBoundingClientRect();
  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${rect.left + window.scrollX}px`;

  document.body.appendChild(popover);
  activePopover = popover;
}

function formatTime(iso: string): string {
  return formatRelativeTime(iso);
}

/**
 * Attach click listener to editor element for suggestion marks.
 */
export function setupSuggestionClickHandler(editor: Editor): void {
  const el = editor.options.element as HTMLElement | null;
  if (!el || !('addEventListener' in el)) return;

  el.addEventListener('click', (event: Event) => {
    const target = event.target as HTMLElement;
    const suggestionEl =
      target.closest('.suggestion-insert') ??
      target.closest('.suggestion-delete');

    if (suggestionEl) {
      showSuggestionPopover(editor, suggestionEl as HTMLElement);
    } else {
      dismissSuggestionPopover();
    }
  });

  document.addEventListener('click', (event) => {
    if (activePopover && !activePopover.contains(event.target as Node)) {
      const target = event.target as HTMLElement;
      if (
        !target.closest('.suggestion-insert') &&
        !target.closest('.suggestion-delete')
      ) {
        dismissSuggestionPopover();
      }
    }
  });
}
