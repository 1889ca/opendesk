/** Contract: contracts/app/rules.md */
/**
 * AI Writing Assistant — UI layer.
 * Provides a floating AI button (appears on text selection) using a BubbleMenu plugin.
 * Popover, dropdown, and loading states are in ai-assist-popover.ts.
 */
import type { Editor } from '@tiptap/core';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import { t } from '../i18n/index.ts';
import type { AssistContext } from './ai-assist-api.ts';
import {
  buildDropdown,
  buildResultPopover,
  showError,
  removePopover,
  showLoadingState,
  type OnActionCallback,
} from './ai-assist-popover.ts';

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

    // Scope the context to the selection so the LLM knows it is operating
    // on a deliberate excerpt, not inferring from whole-document position.
    const selectionContext: AssistContext = {
      type: 'selection',
      label: t('ai.contextSelection'),
    };
    buildDropdown(btn, selectedText, selectionContext, onAction);
  });

  editor.registerPlugin(
    BubbleMenuPlugin({
      pluginKey: 'aiAssistBubble',
      editor,
      element: container,
    }),
  );
}

export { buildResultPopover, showError, removePopover, showLoadingState };
