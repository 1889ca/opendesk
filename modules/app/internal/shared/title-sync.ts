/** Contract: contracts/app/rules.md */

/**
 * Shared title synchronization for all editor pages.
 * Loads the document title from the API and saves changes on blur/input.
 */

import { apiFetch } from './api-client.ts';

export function setupTitleSync(docId: string, suffix = 'OpenDesk'): void {
  const titleInput = document.getElementById('doc-title') as HTMLInputElement | null;
  if (!titleInput) return;

  apiFetch(`/api/documents/${encodeURIComponent(docId)}`)
    .then((res) => { if (!res.ok) throw new Error('Not found'); return res.json(); })
    .then((doc: { title?: string }) => {
      const resolved = doc.title || 'Untitled';
      titleInput.value = resolved;
      document.title = `${resolved} - ${suffix}`;
      // Also update canvas title if present (#337 — canvas title stuck on "Loading...")
      const canvasTitle = document.getElementById('canvas-doc-title') as HTMLInputElement | null;
      if (canvasTitle) canvasTitle.value = resolved;
    })
    .catch(() => { window.location.href = '/'; });

  let debounceTimer: ReturnType<typeof setTimeout>;

  function saveTitle(): void {
    const newTitle = titleInput!.value.trim();
    if (!newTitle) return;
    document.title = `${newTitle} - ${suffix}`;
    apiFetch(`/api/documents/${encodeURIComponent(docId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    }).catch((err) => console.error('Title save failed', err));
  }

  titleInput.addEventListener('blur', () => { clearTimeout(debounceTimer); saveTitle(); });
  titleInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveTitle, 800);
  });
}
