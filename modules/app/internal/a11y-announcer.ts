/** Contract: contracts/app/rules.md */

let announcer: HTMLElement | null = null;

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

/** Announce a message to screen readers via aria-live region. */
export function announce(message: string): void {
  const el = getAnnouncer();
  el.textContent = '';
  void el.offsetHeight;
  el.textContent = message;
}
