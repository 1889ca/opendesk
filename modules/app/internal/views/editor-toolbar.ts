/** Contract: contracts/app/shell.md */

/**
 * Builds the editor page toolbar (title, import/export, share, status).
 * Extracted from the inline scripts in editor.html.
 */

import { t, onLocaleChange } from '../i18n/index.ts';
import { apiFetch } from '../api-client.ts';

export interface EditorToolbarResult {
  toolbarEl: HTMLElement;
  titleInput: HTMLInputElement;
  statusEl: HTMLElement;
  usersEl: HTMLElement;
}

export function buildEditorToolbar(documentId: string): EditorToolbarResult {
  const toolbar = document.createElement('header');
  toolbar.className = 'toolbar';

  const left = document.createElement('div');
  left.className = 'toolbar-left';

  const backLink = document.createElement('a');
  backLink.href = '/';
  backLink.className = 'back-link';
  backLink.textContent = t('editor.backToDocuments');
  onLocaleChange(() => { backLink.textContent = t('editor.backToDocuments'); });

  const sep1 = document.createElement('span');
  sep1.className = 'toolbar-separator';

  const titleInput = document.createElement('input');
  titleInput.id = 'doc-title';
  titleInput.className = 'doc-title-input';
  titleInput.type = 'text';
  titleInput.value = 'Loading...';
  titleInput.spellcheck = false;

  setupTitleSave(titleInput, documentId);

  left.appendChild(backLink);
  left.appendChild(sep1);
  left.appendChild(titleInput);

  const right = document.createElement('div');
  right.className = 'toolbar-right';

  // Export group
  const exportGroup = buildExportGroup(documentId);
  right.appendChild(exportGroup);

  const sep2 = document.createElement('span');
  sep2.className = 'toolbar-separator';
  right.appendChild(sep2);

  const shareBtn = document.createElement('button');
  shareBtn.id = 'share-btn';
  shareBtn.className = 'export-btn share-btn';
  shareBtn.title = 'Share this document';
  shareBtn.textContent = 'Share';
  right.appendChild(shareBtn);

  const sep3 = document.createElement('span');
  sep3.className = 'toolbar-separator';
  right.appendChild(sep3);

  const statusEl = document.createElement('span');
  statusEl.id = 'status';
  statusEl.className = 'status disconnected';
  statusEl.textContent = t('status.connecting');
  right.appendChild(statusEl);

  const usersLabel = document.createElement('span');
  usersLabel.className = 'users-label';
  usersLabel.textContent = t('editor.editors');
  onLocaleChange(() => { usersLabel.textContent = t('editor.editors'); });
  right.appendChild(usersLabel);

  const usersEl = document.createElement('span');
  usersEl.id = 'users';
  usersEl.className = 'users';
  usersEl.textContent = '-';
  right.appendChild(usersEl);

  const sep4 = document.createElement('span');
  sep4.className = 'toolbar-separator';
  right.appendChild(sep4);

  const langSlot = document.createElement('span');
  langSlot.id = 'lang-switcher';
  right.appendChild(langSlot);

  toolbar.appendChild(left);
  toolbar.appendChild(right);

  return { toolbarEl: toolbar, titleInput, statusEl, usersEl };
}

function setupTitleSave(input: HTMLInputElement, docId: string): void {
  let timer: ReturnType<typeof setTimeout>;

  function save() {
    const title = input.value.trim();
    if (!title) return;
    document.title = title + ' - OpenDesk';
    apiFetch('/api/documents/' + encodeURIComponent(docId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).catch((err) => console.error('Title save failed', err));
  }

  input.addEventListener('blur', () => { clearTimeout(timer); save(); });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(save, 800); });
}

function buildExportGroup(docId: string): HTMLElement {
  const group = document.createElement('div');
  group.className = 'export-group';

  const importBtn = createExportBtn('import-file', 'Import', 'Import .docx, .odt, or .pdf');
  const sep = document.createElement('span');
  sep.className = 'toolbar-separator';
  const htmlBtn = createExportBtn('export-html', 'HTML', t('export.htmlTitle'));
  const textBtn = createExportBtn('export-text', 'Text', t('export.textTitle'));
  const docxBtn = createExportBtn('export-docx', 'DOCX', 'Export as Word document');
  const odtBtn = createExportBtn('export-odt', 'ODT', 'Export as OpenDocument');

  setupExportHandlers(docId, htmlBtn, textBtn, docxBtn, odtBtn, importBtn);

  group.appendChild(importBtn);
  group.appendChild(sep);
  group.appendChild(htmlBtn);
  group.appendChild(textBtn);
  group.appendChild(docxBtn);
  group.appendChild(odtBtn);

  return group;
}

function createExportBtn(id: string, text: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.className = 'export-btn';
  btn.title = title;
  btn.textContent = text;
  return btn;
}

function getEditor(): Editor | null {
  return (window as Record<string, unknown>).editor as Editor | null;
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

function setupExportHandlers(
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

  // Import
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

// Type shim for Editor access through window
interface Editor {
  getHTML(): string;
  getText(): string;
  commands: { setContent(content: unknown): void };
}
