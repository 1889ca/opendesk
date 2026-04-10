/** Contract: contracts/app/rules.md */

let active = false;

export function toggleFocusMode(): void {
  active = !active;
  document.body.classList.toggle('focus-mode', active);
  const btn = document.getElementById('focus-mode-btn');
  if (btn) btn.setAttribute('aria-pressed', String(active));
}

export function isFocusModeActive(): boolean { return active; }

export function initFocusModeButton(): void {
  const toolbarRight = document.querySelector('.toolbar-right');
  if (toolbarRight) {
    const btn = document.createElement('button');
    btn.id = 'focus-mode-btn';
    btn.className = 'btn btn-ghost btn-sm';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('title', 'Focus mode (\u2318\u21e7F)');
    btn.textContent = 'Focus';
    btn.addEventListener('click', () => toggleFocusMode());
    toolbarRight.appendChild(btn);
  }
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      toggleFocusMode();
    }
  });
}
