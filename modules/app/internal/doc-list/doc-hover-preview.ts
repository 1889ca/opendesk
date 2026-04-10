/** Contract: contracts/app/rules.md */

/**
 * Hover preview popover for document rows and cards (issue #231).
 * Shows first ~200 chars of document content after a 400ms delay.
 * Fetches GET /api/documents/:id/preview → { preview: string }.
 */

import { apiFetch } from '../shared/api-client.ts';

let activePreview: HTMLElement | null = null;

function dismissPreview(): void {
  activePreview?.remove();
  activePreview = null;
}

function showPreview(text: string, x: number, y: number): void {
  dismissPreview();

  const el = document.createElement('div');
  el.className = 'doc-hover-preview';
  el.textContent = text || '(No preview available)';

  document.body.appendChild(el);
  activePreview = el;

  // Position — keep within viewport
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = x + rect.width + 12 > vw ? x - rect.width - 8 : x + 12;
  const top = y + rect.height > vh ? vh - rect.height - 8 : y;
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

/**
 * Attach hover-preview behaviour to a document row or card element.
 * Fetches /api/documents/:id/preview on mouseenter (400ms debounce).
 * Cancels and hides on mouseleave.
 */
export function attachHoverPreview(wrapper: HTMLElement, docId: string): void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  wrapper.addEventListener('mouseenter', () => {
    timer = setTimeout(async () => {
      try {
        const res = await apiFetch('/api/documents/' + encodeURIComponent(docId) + '/preview');
        if (!res.ok) return;
        const data = await res.json() as { preview?: string };
        if (data.preview !== undefined) {
          const rect = wrapper.getBoundingClientRect();
          showPreview(data.preview, rect.right, rect.top);
        }
      } catch {
        // Preview fetch failed silently
      }
    }, 400);
  });

  wrapper.addEventListener('mouseleave', () => {
    if (timer) { clearTimeout(timer); timer = null; }
    dismissPreview();
  });
}
