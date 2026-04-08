/** Contract: contracts/app/shell.md */

/**
 * Export/import handlers for the editor toolbar.
 * Handles HTML, text, DOCX, ODT exports and file imports.
 */

import { apiFetch } from '../api-client.ts';

// Type shim for Editor access through window
interface EditorShim {
  getHTML(): string;
  getText(): string;
  commands: { setContent(content: unknown): void };
}

function getEditor(): EditorShim | null {
  return (window as unknown as Record<string, unknown>).editor as EditorShim | null;
}

function getTitle(): string {
  const input = document.getElementById('doc-title') as HTMLInputElement | null;
  return input?.value?.trim() || 'document';
}

function downloadBlob(content: BlobPart, filename: string, mimeType: string): void {
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

export function setupExportHandlers(
  docId: string,
  htmlBtn: HTMLButtonElement,
  textBtn: HTMLButtonElement,
  docxBtn: HTMLButtonElement,
  odtBtn: HTMLButtonElement,
  importBtn: HTMLButtonElement,
): void {
  htmlBtn.addEventListener('click', () => {
    const ed = getEditor();
    if (!ed) return;
    const html = ed.getHTML();
    const title = getTitle();
    const full = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>${title}</title>\n</head>\n<body>\n${html}\n</body>\n</html>`;
    downloadBlob(full, title + '.html', 'text/html');
  });

  textBtn.addEventListener('click', () => {
    const ed = getEditor();
    if (!ed) return;
    downloadBlob(ed.getText(), getTitle() + '.txt', 'text/plain');
  });

  const exportVia = (format: string, btn: HTMLButtonElement) => {
    const ed = getEditor();
    if (!ed) return;
    btn.disabled = true;
    btn.textContent = '...';
    apiFetch(`/api/documents/${encodeURIComponent(docId)}/convert-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, content: ed.getHTML() }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 502 ? 'Conversion service unavailable' : 'Export failed');
        return res.blob();
      })
      .then((blob) => downloadBlob(blob, getTitle() + '.' + format, 'application/octet-stream'))
      .catch((err) => alert(err.message))
      .finally(() => { btn.disabled = false; btn.textContent = format.toUpperCase(); });
  };

  docxBtn.addEventListener('click', () => exportVia('docx', docxBtn));
  odtBtn.addEventListener('click', () => exportVia('odt', odtBtn));

  setupImportHandler(docId, importBtn);
}

function setupImportHandler(docId: string, importBtn: HTMLButtonElement): void {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.docx,.odt,.pdf';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = '';
    if (!confirm('Importing will replace the current document content. Continue?')) return;

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
      .then((data) => {
        const ed = getEditor();
        if (ed && data.snapshot?.content) ed.commands.setContent(data.snapshot.content);
      })
      .catch((err) => alert(err.message))
      .finally(() => { importBtn.disabled = false; importBtn.textContent = 'Import'; });
  });
}
