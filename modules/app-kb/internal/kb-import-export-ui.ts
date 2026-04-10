/** Contract: contracts/app-kb/rules.md */

import { exportKBAsZip, importKBFile } from './kb-api.ts';
import { showToast } from '../../app/internal/shared/toast.ts';

/**
 * Trigger a browser download for the given Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Handle the export flow: fetch ZIP from API and trigger download.
 */
async function handleExport(btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  btn.textContent = 'Exporting\u2026';
  try {
    const blob = await exportKBAsZip();
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `kb-export-${date}.zip`);
    showToast('Knowledge base exported successfully', 'success');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Export failed';
    showToast(msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Export as Markdown (ZIP)';
  }
}

/**
 * Handle the import flow: open file picker, POST to API, show result.
 */
function handleImport(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.zip,.html,.htm,text/markdown,application/zip,text/html';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;

    showToast(`Importing ${file.name}\u2026`, 'info');
    try {
      const result = await importKBFile(file);
      if (result.errors.length > 0) {
        showToast(
          `Imported ${result.imported} entries with ${result.errors.length} error(s)`,
          'error',
        );
      } else {
        showToast(`Imported ${result.imported} entr${result.imported === 1 ? 'y' : 'ies'} successfully`, 'success');
      }
      // Notify parent to refresh list
      document.dispatchEvent(new CustomEvent('kb:import-complete'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      showToast(msg, 'error');
    }
  });

  input.click();
}

/**
 * Build the Export dropdown button element.
 * Returns the button which callers append to the toolbar.
 */
export function buildExportButton(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'kb-export-menu';

  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.textContent = 'Export as Markdown (ZIP)';
  btn.setAttribute('aria-label', 'Export knowledge base as Markdown ZIP');
  btn.addEventListener('click', () => handleExport(btn));

  wrapper.appendChild(btn);
  return wrapper;
}

/**
 * Build the Import button element.
 */
export function buildImportButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.textContent = 'Import';
  btn.setAttribute('aria-label', 'Import entries from Markdown, Notion, or Confluence');
  btn.addEventListener('click', () => handleImport());
  return btn;
}
