/** Contract: contracts/app/rules.md */

const STORAGE_KEY = 'opendesk-sidebar-width';
const MIN_WIDTH = 260;
const MAX_WIDTH = () => Math.round(window.innerWidth * 0.5);

export function initSidebarResize(panel: HTMLElement): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) panel.style.width = `${saved}px`;

  const handle = document.createElement('div');
  handle.className = 'sidebar-resize-handle';
  panel.prepend(handle);

  let startX = 0;
  let startWidth = 0;

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  function onMove(e: MouseEvent): void {
    const delta = startX - e.clientX; // sidebar is on the right
    const newWidth = Math.min(Math.max(startWidth + delta, MIN_WIDTH), MAX_WIDTH());
    panel.style.width = `${newWidth}px`;
  }

  function onUp(): void {
    localStorage.setItem(STORAGE_KEY, String(panel.offsetWidth));
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
}
