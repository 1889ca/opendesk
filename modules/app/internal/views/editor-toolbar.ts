/** Contract: contracts/app/shell.md */

/**
 * Builds the editor page toolbar (title, import/export, share, status).
 * Extracted from the inline scripts in editor.html.
 */

import { t, onLocaleChange } from '../i18n/index.ts';
import { apiFetch } from '../shared/api-client.ts';
import { setupExportHandlers } from './export-handlers.ts';

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

  const exportGroup = buildExportGroup(documentId);
  right.appendChild(exportGroup);

  appendSeparator(right);
  appendShareButton(right);
  appendSeparator(right);

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

  appendSeparator(right);
  const langSlot = document.createElement('span');
  langSlot.id = 'lang-switcher';
  right.appendChild(langSlot);

  toolbar.appendChild(left);
  toolbar.appendChild(right);

  return { toolbarEl: toolbar, titleInput, statusEl, usersEl };
}

function appendSeparator(parent: HTMLElement): void {
  const sep = document.createElement('span');
  sep.className = 'toolbar-separator';
  parent.appendChild(sep);
}

function appendShareButton(parent: HTMLElement): void {
  const btn = document.createElement('button');
  btn.id = 'share-btn';
  btn.className = 'btn btn-ghost btn-sm share-btn';
  btn.title = 'Share this document';
  btn.textContent = 'Share';
  parent.appendChild(btn);
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
    }).catch((err: unknown) => console.error('Title save failed', err));
  }

  input.addEventListener('blur', () => { clearTimeout(timer); save(); });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(save, 800); });
}

function createExportBtn(id: string, text: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.className = 'btn btn-ghost btn-sm';
  btn.title = title;
  btn.textContent = text;
  return btn;
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
