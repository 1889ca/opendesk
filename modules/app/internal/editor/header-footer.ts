/** Contract: contracts/app/rules.md */

const STORAGE_KEY_PREFIX = 'opendesk-hf-';

function storageKey(docId: string, part: 'header' | 'footer'): string {
  return `${STORAGE_KEY_PREFIX}${docId}-${part}`;
}

function saveContent(docId: string, part: 'header' | 'footer', content: string): void {
  localStorage.setItem(storageKey(docId, part), content);
}

function loadContent(docId: string, part: 'header' | 'footer'): string {
  return localStorage.getItem(storageKey(docId, part)) || '';
}

export function activateZone(zone: HTMLElement): void {
  zone.classList.add('is-active');
}

export function deactivateZone(zone: HTMLElement): void {
  zone.classList.remove('is-active');
}

function createZone(part: 'header' | 'footer', docId: string): HTMLElement {
  const zone = document.createElement('div');
  zone.className = `doc-${part}-zone`;
  zone.contentEditable = 'true';
  zone.spellcheck = true;
  zone.setAttribute('role', 'region');
  zone.setAttribute('aria-label', part === 'header' ? 'Document header' : 'Document footer');

  const saved = loadContent(docId, part);
  if (saved) {
    zone.innerHTML = saved;
    activateZone(zone);
  }

  zone.addEventListener('input', () => {
    saveContent(docId, part, zone.innerHTML);
  });

  return zone;
}

export function insertHeaderFooter(docId: string): { headerZone: HTMLElement; footerZone: HTMLElement } {
  const editorEl = document.getElementById('editor');
  const wrapper = document.querySelector('.editor-wrapper');
  if (!editorEl || !wrapper) {
    return { headerZone: document.createElement('div'), footerZone: document.createElement('div') };
  }

  const headerZone = createZone('header', docId);
  const footerZone = createZone('footer', docId);

  wrapper.insertBefore(headerZone, editorEl);
  editorEl.insertAdjacentElement('afterend', footerZone);

  return { headerZone, footerZone };
}

export function setupHeaderFooterClicks(headerZone: HTMLElement, footerZone: HTMLElement): void {
  const wrapper = document.querySelector('.editor-wrapper');
  if (!wrapper) return;
  wrapper.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target !== wrapper) return;
    const editorRect = document.getElementById('editor')?.getBoundingClientRect();
    if (!editorRect) return;
    const mouseY = (e as MouseEvent).clientY;
    if (mouseY < editorRect.top) { activateZone(headerZone); headerZone.focus(); }
    else if (mouseY > editorRect.bottom) { activateZone(footerZone); footerZone.focus(); }
  });
}

export function insertPageNumber(zone: HTMLElement): void {
  const marker = document.createElement('span');
  marker.className = 'page-num-marker';
  marker.textContent = '1';
  marker.title = 'Page number (updates on print)';
  zone.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.insertNode(marker);
    range.collapse(false);
  } else {
    zone.appendChild(marker);
  }
  zone.dispatchEvent(new Event('input'));
}
