/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange } from '../i18n/index.ts';
import { batchRaf } from './lifecycle.ts';

const LANGUAGES = [
  { value: '', label: () => t('codeBlock.plainText') },
  { value: 'javascript', label: () => 'JavaScript' },
  { value: 'typescript', label: () => 'TypeScript' },
  { value: 'python', label: () => 'Python' },
  { value: 'java', label: () => 'Java' },
  { value: 'go', label: () => 'Go' },
  { value: 'rust', label: () => 'Rust' },
  { value: 'sql', label: () => 'SQL' },
  { value: 'html', label: () => 'HTML' },
  { value: 'css', label: () => 'CSS' },
  { value: 'json', label: () => 'JSON' },
  { value: 'bash', label: () => 'Bash' },
  { value: 'markdown', label: () => 'Markdown' },
];

function buildOverlay(editor: Editor): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'code-block-overlay';

  const select = document.createElement('select');
  select.className = 'code-block-lang-select';
  select.setAttribute('aria-label', t('codeBlock.language'));
  populateSelect(select);

  select.addEventListener('change', () => {
    editor.chain().focus().updateAttributes('codeBlock', { language: select.value }).run();
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'code-block-copy-btn';
  copyBtn.type = 'button';
  copyBtn.textContent = t('codeBlock.copy');
  copyBtn.addEventListener('click', () => {
    const code = getActiveCodeBlockText(editor);
    if (code === null) return;
    navigator.clipboard.writeText(code).then(() => {
      copyBtn.textContent = t('codeBlock.copied');
      setTimeout(() => { copyBtn.textContent = t('codeBlock.copy'); }, 1500);
    });
  });

  onLocaleChange(() => {
    select.setAttribute('aria-label', t('codeBlock.language'));
    populateSelect(select);
    copyBtn.textContent = t('codeBlock.copy');
  });

  overlay.appendChild(select);
  overlay.appendChild(copyBtn);
  return overlay;
}

function populateSelect(select: HTMLSelectElement): void {
  const current = select.value;
  select.innerHTML = '';
  for (const lang of LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang.value;
    opt.textContent = lang.label();
    select.appendChild(opt);
  }
  select.value = current;
}

function getActiveCodeBlockText(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'codeBlock') {
      return node.textContent;
    }
  }
  return null;
}

function getActiveCodeBlockLanguage(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'codeBlock') {
      return (node.attrs.language as string) || '';
    }
  }
  return null;
}

export function setupCodeBlockUI(editor: Editor): void {
  const editorEl = editor.options.element as HTMLElement;
  const overlay = buildOverlay(editor);
  overlay.style.display = 'none';
  editorEl.appendChild(overlay);

  const select = overlay.querySelector('.code-block-lang-select') as HTMLSelectElement;

  const batched = batchRaf(() => positionOverlay(editor, editorEl, overlay, select));
  editor.on('selectionUpdate', batched.call);
  editor.on('update', batched.call);
}

function positionOverlay(
  editor: Editor, editorEl: HTMLElement,
  overlay: HTMLDivElement, select: HTMLSelectElement,
): void {
  const lang = getActiveCodeBlockLanguage(editor);
  if (lang === null) {
    overlay.style.display = 'none';
    return;
  }

  select.value = lang;
  overlay.style.display = 'flex';

  const { $from } = editor.state.selection;
  let codeBlockPos = 0;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === 'codeBlock') {
      codeBlockPos = $from.start(d) - 1;
      break;
    }
  }

  const domNode = editor.view.nodeDOM(codeBlockPos);
  if (!(domNode instanceof HTMLElement)) {
    overlay.style.display = 'none';
    return;
  }

  const editorRect = editorEl.getBoundingClientRect();
  const blockRect = domNode.getBoundingClientRect();
  overlay.style.top = `${blockRect.top - editorRect.top + 6}px`;
  overlay.style.right = `${editorRect.right - blockRect.right + 8}px`;
}
