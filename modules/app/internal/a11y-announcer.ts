/** Contract: contracts/app/rules.md */

let announcer: HTMLElement | null = null;

/** Get or create the ARIA live region for screen reader announcements. */
function getAnnouncer(): HTMLElement {
  if (announcer) return announcer;
  announcer = document.createElement('div');
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'sr-only';
  document.body.appendChild(announcer);
  return announcer;
}

/**
 * Announce a message to screen readers via aria-live region.
 * Clears after a short delay to allow repeated announcements.
 */
export function announce(message: string): void {
  const el = getAnnouncer();
  el.textContent = '';
  // Force reflow so repeated messages are re-announced
  void el.offsetHeight;
  el.textContent = message;
}
