/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t } from '../i18n/index.ts';
import { showCommentInput, type CommentStore } from './comments/index.ts';
import { announce } from '../shared/a11y-announcer.ts';
import { buildStatusBar } from './status-bar.ts';
import { openCitationPicker, createBibliography } from './citations/index.ts';
import { setupPromoteToKB } from './promote-to-kb.ts';
import { buildFootnotePanel } from './footnote-panel.ts';

export interface PanelDeps {
  editor: Editor;
  editorEl: HTMLElement;
  commentStore: CommentStore;
  documentId: string;
  user: { name: string; color: string };
}

/**
 * Wire up non-rail panels and event listeners that hang off the editor.
 * Rail-based panels (comments, suggestions, versions, workflows,
 * references, special chars) are now mounted in buildPanelRail calls
 * inside editor.ts.
 */
export function initEditorPanels(deps: PanelDeps): void {
  const { editor, editorEl, commentStore, documentId, user } = deps;

  const statusBar = buildStatusBar(editor);
  document.body.appendChild(statusBar.el);

  const bib = createBibliography(editor);
  const editorWrapper = editorEl.closest('.editor-wrapper');
  if (editorWrapper) {
    editorWrapper.appendChild(bib.element);
  } else {
    editorEl.parentElement?.appendChild(bib.element);
  }

  setupPromoteToKB(editor);

  const footnote = buildFootnotePanel(editor);
  const editorWrapperEl = editorEl.closest('.editor-wrapper');
  if (editorWrapperEl) {
    editorWrapperEl.appendChild(footnote.el);
  } else {
    editorEl.parentElement?.appendChild(footnote.el);
  }

  document.addEventListener('opendesk:insert-citation', () => {
    const citeBtn = document.querySelector('[data-action="insert-citation"]') as HTMLElement | null;
    const fallback = citeBtn ?? editorEl;
    openCitationPicker(editor, fallback);
  });

  document.addEventListener('opendesk:add-comment', () => {
    showCommentInput(editor, commentStore, documentId, user);
    announce(t('a11y.commentAdded'));
  });
}
