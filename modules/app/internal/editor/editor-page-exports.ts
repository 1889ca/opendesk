/** Contract: contracts/app/rules.md */
/**
 * Editor page export/import handlers.
 * Extracted from editor-page.ts to keep files under 200 lines.
 */
import { apiFetch } from '../shared/api-client.ts';
import { getBibliographyHtml } from './citations/index.ts';
import { showToast } from '../shared/toast.ts';
import type { Editor } from '@tiptap/core';

function getTitle(): string {
  const input = document.getElementById('doc-title') as HTMLInputElement | null;
  return input?.value?.trim() || 'document';
}

function waitForEditor(cb: (editor: Editor) => void | Promise<void>): void {
  const win = window as unknown as { editor?: Editor };
  if (win.editor) { cb(win.editor); return; }
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (win.editor) { clearInterval(interval); cb(win.editor); }
    if (attempts > 100) clearInterval(interval);
  }, 100);
}

export function downloadBlob(content: BlobPart, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function setupClientExports(): void {
  document.getElementById('export-html')?.addEventListener('click', () => {
    waitForEditor(async (editor) => {
      const html = editor.getHTML();
      const bibHtml = await getBibliographyHtml(editor);
      const title = getTitle();
      const body = bibHtml ? `${html}\n${bibHtml}` : html;
      const full = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>${title}</title>\n</head>\n<body>\n${body}\n</body>\n</html>`;
      downloadBlob(full, `${title}.html`, 'text/html');
      showToast('Exported as HTML', 'success');
    });
  });

  document.getElementById('export-text')?.addEventListener('click', () => {
    waitForEditor((editor) => {
      downloadBlob(editor.getText(), `${getTitle()}.txt`, 'text/plain');
      showToast('Exported as plain text', 'success');
    });
  });
}

export function setupCollaboraExports(docId: string): void {
  function exportViaCollabora(format: string): void {
    waitForEditor(async (editor) => {
      const html = editor.getHTML();
      const bibHtml = await getBibliographyHtml(editor);
      const content = bibHtml ? `${html}\n${bibHtml}` : html;
      const btn = document.getElementById(`export-${format}`) as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = '...';

      apiFetch(`/api/documents/${encodeURIComponent(docId)}/convert-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, content }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(res.status === 502 ? 'Conversion service unavailable' : 'Export failed');
          return res.blob();
        })
        .then((blob) => { downloadBlob(blob, `${getTitle()}.${format}`, blob.type); showToast(`Exported as ${format.toUpperCase()}`, 'success'); })
        .catch((err: Error) => showToast(err.message, 'error'))
        .finally(() => { btn.disabled = false; btn.textContent = format.toUpperCase(); });
    });
  }

  document.getElementById('export-docx')?.addEventListener('click', () => exportViaCollabora('docx'));
  document.getElementById('export-odt')?.addEventListener('click', () => exportViaCollabora('odt'));
}

export function setupImport(docId: string): void {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.docx,.odt,.pdf';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  document.getElementById('import-file')?.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = '';

    if (!confirm('Importing will replace the current document content. Continue?')) return;

    const importBtn = document.getElementById('import-file') as HTMLButtonElement;
    importBtn.disabled = true;
    importBtn.textContent = '...';

    file.arrayBuffer()
      .then((buf) => apiFetch(`/api/documents/${encodeURIComponent(docId)}/convert-import`, {
        method: 'POST',
        headers: { 'X-Filename': file.name },
        body: buf,
      }))
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 502 ? 'Conversion service unavailable' : 'Import failed');
        return res.json();
      })
      .then((data: { snapshot?: { content?: unknown } }) => {
        waitForEditor((editor) => {
          if (data.snapshot?.content) editor.commands.setContent(data.snapshot.content);
        });
      })
      .catch((err) => alert(err.message))
      .finally(() => { importBtn.disabled = false; importBtn.textContent = 'Import'; });
  });
}
