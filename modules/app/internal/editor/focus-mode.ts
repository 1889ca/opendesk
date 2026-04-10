/** Contract: contracts/app/rules.md */

let active = false;

export function toggleFocusMode(): void {
  active = !active;
  document.body.classList.toggle('focus-mode', active);
  // Update button aria-pressed if button exists
  const btn = document.getElementById('focus-mode-btn');
  if (btn) btn.setAttribute('aria-pressed', String(active));
}

export function isFocusModeActive(): boolean { return active; }
