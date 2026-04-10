/** Contract: contracts/app/rules.md */
/**
 * AI Writing Assistant — UI layer.
 * Provides a floating AI button (appears on text selection) with dropdown,
 * and a result popover with Insert / Replace / Discard actions.
 */
import type { Editor } from '@tiptap/core';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import { t } from '../i18n/index.ts';
import type { AssistAction } from './ai-assist-api.ts';

const ACTIONS: Array<{ action: AssistAction; labelKey: Parameters<typeof t>[0] }> = [
  { action: 'improve',     labelKey: 'ai.improve' },
  { action: 'summarize',   labelKey: 'ai.summarize' },
  { action: 'expand',      labelKey: 'ai.expand' },
  { action: 'shorten',     labelKey: 'ai.shorten' },
  { action: 'fix-grammar', labelKey: 'ai.fixGrammar' },
  { action: 'continue',    labelKey: 'ai.continue' },
];

type OnActionCallback = (action: AssistAction, text: string) => Promise<void>;

function removePopover(): void {
  document.querySelector('.ai-assist-popover')?.remove();
  document.querySelector('.ai-assist-dropdown')?.remove();
}

function buildDropdown(
  anchor: HTMLElement,
  selectedText: string,
  onAction: OnActionCallback,
): void {
  document.querySelector('.ai-assist-dropdown')?.remove();

  const rect = anchor.getBoundingClientRect();
  const dropdown = document.createElement('div');
  dropdown.className = 'ai-assist-dropdown';
  dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
  dropdown.style.left = `${rect.left + window.scrollX}px`;
  dropdown.setAttribute('role', 'menu');

  for (const { action, labelKey } of ACTIONS) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'ai-assist-dropdown-item';
    item.textContent = t(labelKey);
    item.setAttribute('role', 'menuitem');
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dropdown.remove();
      onAction(action, selectedText).catch(() => {});
    });
    dropdown.appendChild(item);
  }

  document.body.appendChild(dropdown);

  function onOutsideClick(e: MouseEvent): void {
    if (!dropdown.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
      dropdown.remove();
      document.removeEventListener('mousedown', onOutsideClick);
    }
  }
  requestAnimationFrame(() => {
    document.addEventListener('mousedown', onOutsideClick);
  });
}

function buildResultPopover(
  anchor: HTMLElement,
  result: string,
  editor: Editor,
): void {
  removePopover();

  const rect = anchor.getBoundingClientRect();
  const popover = document.createElement('div');
  popover.className = 'ai-assist-popover';
  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${rect.left + window.scrollX}px`;

  const preview = document.createElement('div');
  preview.className = 'ai-assist-preview';
  preview.textContent = result;

  const actions = document.createElement('div');
  actions.className = 'ai-assist-popover-actions';

  const insertBtn = document.createElement('button');
  insertBtn.type = 'button';
  insertBtn.className = 'ai-assist-btn ai-assist-btn--primary';
  insertBtn.textContent = t('ai.insert');
  insertBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    // Insert after selection without replacing it
    const { to } = editor.state.selection;
    editor.chain().focus().insertContentAt(to, ' ' + result).run();
    removePopover();
  });

  const replaceBtn = document.createElement('button');
  replaceBtn.type = 'button';
  replaceBtn.className = 'ai-assist-btn ai-assist-btn--primary';
  replaceBtn.textContent = t('ai.replace');
  replaceBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    editor.chain().focus().insertContent(result).run();
    removePopover();
  });

  const discardBtn = document.createElement('button');
  discardBtn.type = 'button';
  discardBtn.className = 'ai-assist-btn ai-assist-btn--ghost';
  discardBtn.textContent = t('ai.discard');
  discardBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    removePopover();
  });

  actions.appendChild(insertBtn);
  actions.appendChild(replaceBtn);
  actions.appendChild(discardBtn);
  popover.appendChild(preview);
  popover.appendChild(actions);

  document.body.appendChild(popover);

  function onOutsideClick(e: MouseEvent): void {
    if (!popover.contains(e.target as Node)) {
      popover.remove();
      document.removeEventListener('mousedown', onOutsideClick);
    }
  }
  requestAnimationFrame(() => {
    document.addEventListener('mousedown', onOutsideClick);
  });
}

function showError(anchor: HTMLElement, message: string): void {
  removePopover();
  const rect = anchor.getBoundingClientRect();
  const popover = document.createElement('div');
  popover.className = 'ai-assist-popover ai-assist-popover--error';
  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${rect.left + window.scrollX}px`;
  popover.textContent = message;
  document.body.appendChild(popover);
  setTimeout(() => popover.remove(), 4000);
}

export function buildAiAssistButton(
  editor: Editor,
  onAction: OnActionCallback,
): void {
  const container = document.createElement('div');
  container.className = 'ai-assist-bubble';
  document.body.appendChild(container);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ai-assist-trigger-btn';
  btn.setAttribute('aria-label', t('ai.buttonLabel'));
  btn.setAttribute('title', t('ai.buttonLabel'));
  btn.textContent = t('ai.buttonLabel');
  container.appendChild(btn);

  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;
    buildDropdown(btn, selectedText, onAction);
  });

  editor.registerPlugin(
    BubbleMenuPlugin({
      pluginKey: 'aiAssistBubble',
      editor,
      element: container,
    }),
  );
}

export function showLoadingState(anchor: HTMLElement): void {
  removePopover();
  const rect = anchor.getBoundingClientRect();
  const popover = document.createElement('div');
  popover.className = 'ai-assist-popover ai-assist-popover--loading';
  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${rect.left + window.scrollX}px`;

  const spinner = document.createElement('span');
  spinner.className = 'ai-assist-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.textContent = t('ai.loading');

  popover.appendChild(spinner);
  popover.appendChild(label);
  document.body.appendChild(popover);
}

export { buildResultPopover, showError, removePopover };
