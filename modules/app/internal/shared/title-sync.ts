/** Contract: contracts/app/rules.md */

/**
 * Shared title synchronization for all editor pages.
 * Loads the document title from the API and saves changes on blur/input.
 * Also resolves folder ancestry and updates the toolbar breadcrumb.
 */

import { apiFetch } from './api-client.ts';
import { updateBreadcrumbFolder, type BreadcrumbSegment } from './app-toolbar.ts';

interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
}

/**
 * Fetch the full ancestor chain for a folder, returning segments ordered
 * from root to the immediate parent of the document (i.e. [root … leaf]).
 * Stops after 10 hops to guard against cycles.
 */
async function fetchFolderPath(folderId: string): Promise<BreadcrumbSegment[]> {
  const segments: BreadcrumbSegment[] = [];
  let currentId: string | null = folderId;
  let hops = 0;

  while (currentId && hops < 10) {
    const res = await apiFetch(`/api/folders/${encodeURIComponent(currentId)}`);
    if (!res.ok) break;
    const folder: FolderRow = await res.json();
    segments.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
    hops++;
  }

  return segments;
}

export function setupTitleSync(docId: string, suffix = 'OpenDesk'): void {
  const titleInput = document.getElementById('doc-title') as HTMLInputElement | null;
  if (!titleInput) return;

  apiFetch(`/api/documents/${encodeURIComponent(docId)}`)
    .then((res) => { if (!res.ok) throw new Error('Not found'); return res.json(); })
    .then(async (doc: { title?: string; folder_id?: string | null }) => {
      titleInput.value = doc.title || 'Untitled';
      document.title = `${doc.title || 'Untitled'} - ${suffix}`;

      if (doc.folder_id) {
        const path = await fetchFolderPath(doc.folder_id);
        updateBreadcrumbFolder(path);
      }
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
