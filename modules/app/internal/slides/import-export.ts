/** Contract: contracts/app/rules.md */

/**
 * Presentation import/export UI handlers.
 * Adds Import and Export buttons to the slides toolbar.
 */

import * as Y from 'yjs';
import { apiFetch } from '../shared/api-client.ts';
import { getDocumentId } from '../shared/identity.ts';
import { extractSlidesData, applyImportedSlides, type SlideData } from './slide-data.ts';

/** Handle presentation export (PDF, PPTX, ODP) */
async function handleExport(
  yslides: Y.Array<Y.Map<unknown>>,
  format: string,
): Promise<void> {
  const documentId = getDocumentId();
  const content = { slides: extractSlidesData(yslides) };

  const res = await apiFetch(`/api/presentations/${documentId}/convert-export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, content }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Export failed' }));
    alert(`Export failed: ${err.error || 'Unknown error'}`);
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presentation.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Handle presentation import (.pptx, .odp) */
async function handleImport(
  ydoc: Y.Doc,
  yslides: Y.Array<Y.Map<unknown>>,
  onComplete: () => void,
): Promise<void> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pptx,.odp';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) { input.remove(); return; }

    const documentId = getDocumentId();
    const buffer = await file.arrayBuffer();

    const res = await apiFetch(`/api/presentations/${documentId}/convert-import`, {
      method: 'POST',
      headers: { 'X-Filename': file.name },
      body: buffer,
    });

    input.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Import failed' }));
      alert(`Import failed: ${err.error || 'Unknown error'}`);
      return;
    }

    const data = await res.json();
    applyImportedSlides(ydoc, yslides, data.snapshot.content.slides as SlideData[]);
    onComplete();
  });

  input.click();
}

/** Build the import/export toolbar buttons */
export function buildImportExportButtons(
  ydoc: Y.Doc,
  yslides: Y.Array<Y.Map<unknown>>,
  onImportComplete: () => void,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'slides-io-buttons';

  const importBtn = document.createElement('button');
  importBtn.className = 'btn btn-secondary';
  importBtn.textContent = 'Import';
  importBtn.title = 'Import .pptx or .odp';
  importBtn.addEventListener('click', () => {
    handleImport(ydoc, yslides, onImportComplete);
  });

  const exportMenu = buildExportMenu(yslides);
  container.appendChild(importBtn);
  container.appendChild(exportMenu);
  return container;
}

/** Build export dropdown with format options */
function buildExportMenu(yslides: Y.Array<Y.Map<unknown>>): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'slides-export-menu';

  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.textContent = 'Export';
  btn.title = 'Export presentation';

  const dropdown = document.createElement('div');
  dropdown.className = 'slides-export-dropdown';
  dropdown.hidden = true;

  const formats = [
    { label: 'PDF (.pdf)', format: 'pdf' },
    { label: 'PowerPoint (.pptx)', format: 'pptx' },
    { label: 'ODP (.odp)', format: 'odp' },
  ];

  for (const { label, format } of formats) {
    const option = document.createElement('button');
    option.className = 'slides-export-option';
    option.textContent = label;
    option.addEventListener('click', () => {
      dropdown.hidden = true;
      handleExport(yslides, format);
    });
    dropdown.appendChild(option);
  }

  btn.addEventListener('click', () => { dropdown.hidden = !dropdown.hidden; });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) dropdown.hidden = true;
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);
  return wrapper;
}
