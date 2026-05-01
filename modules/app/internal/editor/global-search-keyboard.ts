/** Contract: contracts/app/rules.md */
/**
 * Keyboard navigation helpers for the global search widget.
 * Extracted from global-search.ts to keep files under 200 lines.
 */

/**
 * Attach keyboard navigation to a search results container.
 * Arrow keys move focus between result cards; Escape clears and closes.
 */
export function attachResultsKeyNav(
  results: HTMLElement,
  input: HTMLInputElement,
  onClose: () => void,
): void {
  results.addEventListener('keydown', (e) => {
    const cards = Array.from(
      results.querySelectorAll<HTMLElement>('.search-result-card'),
    );
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? cards.indexOf(active) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < cards.length - 1) cards[idx + 1].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) {
        input.focus();
      } else {
        cards[idx - 1].focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      input.focus();
    }
  });
}

/**
 * Register the Cmd/Ctrl+K global shortcut to focus the search input.
 * Returns a cleanup function.
 */
export function registerSearchShortcut(input: HTMLInputElement): () => void {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
