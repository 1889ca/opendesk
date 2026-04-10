/** Contract: contracts/app/rules.md */
/**
 * AI Writing Assistant — integration entry point.
 * Wires the AI assist UI into the TipTap editor.
 */
import type { Editor } from '@tiptap/core';
import { callAssist, type AssistAction } from './ai-assist-api.ts';
import {
  buildAiAssistButton,
  buildResultPopover,
  showError,
  showLoadingState,
  removePopover,
} from './ai-assist-ui.ts';
import { t } from '../i18n/index.ts';

export function initAiAssist(editor: Editor): void {
  let triggerBtn: HTMLButtonElement | null = null;

  function onAction(action: AssistAction, text: string): Promise<void> {
    const anchor = triggerBtn ?? document.querySelector<HTMLButtonElement>('.ai-assist-trigger-btn');
    if (anchor) showLoadingState(anchor);

    return callAssist({ action, text }).then((res) => {
      removePopover();
      const anchorEl = anchor ?? document.querySelector<HTMLButtonElement>('.ai-assist-trigger-btn');
      if (anchorEl) {
        buildResultPopover(anchorEl, res.result, editor);
      }
    }).catch((err: Error) => {
      removePopover();
      const anchorEl = anchor ?? document.querySelector<HTMLButtonElement>('.ai-assist-trigger-btn');
      const message = err.message || t('ai.error');
      if (anchorEl) showError(anchorEl, message);
    });
  }

  buildAiAssistButton(editor, onAction);

  // Capture reference to trigger button after it's rendered
  requestAnimationFrame(() => {
    triggerBtn = document.querySelector<HTMLButtonElement>('.ai-assist-trigger-btn');
  });
}
