/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t } from '../i18n/index.ts';
import { buildCommentSidebar, toggleSidebar, showCommentInput, type CommentStore } from './comments/index.ts';
import {
  buildSuggestionSidebar,
  toggleSuggestionSidebar,
} from './suggestions/index.ts';
import { announce } from '../shared/a11y-announcer.ts';
import { buildTocPanel, toggleTocPanel } from './toc/index.ts';
import { buildVersionSidebar, toggleVersionSidebar } from './version-history.ts';
import { buildWorkflowPanel, toggleWorkflowPanel } from './workflow-panel.ts';
import { buildStatusBar } from './status-bar.ts';
import { openCitationPicker, createBibliography, buildReferenceLibrary } from './citations/index.ts';
import { setupPromoteToKB } from './promote-to-kb.ts';

export interface PanelDeps {
  editor: Editor;
  editorEl: HTMLElement;
  commentStore: CommentStore;
  documentId: string;
  user: { name: string; color: string };
}

/**
 * Wire up all panels, sidebars, and event listeners that hang off the
 * editor. Returns nothing — side-effects only (DOM mutations, event
 * listeners).
 */
export function initEditorPanels(deps: PanelDeps): void {
  const { editor, editorEl, commentStore, documentId, user } = deps;

  const editorWrapper = editorEl.closest('.editor-wrapper');
  if (editorWrapper) {
    editorWrapper.appendChild(buildStatusBar(editor));
  }

  const bib = createBibliography(editor);
  if (editorWrapper) {
    editorWrapper.appendChild(bib.element);
  } else {
    editorEl.parentElement?.appendChild(bib.element);
  }

  const commentSidebar = buildCommentSidebar(editor, commentStore, documentId, user);
  document.body.appendChild(commentSidebar);

  const suggestionSidebar = buildSuggestionSidebar(editor);
  document.body.appendChild(suggestionSidebar);

  const tocPanel = buildTocPanel(editor);
  document.body.appendChild(tocPanel);
  document.addEventListener('opendesk:toggle-toc', () => {
    // Mutually exclusive with the comment sidebar
    toggleSidebar(commentSidebar, false);
    toggleTocPanel(tocPanel);
  });

  const versionSidebar = buildVersionSidebar();
  document.body.appendChild(versionSidebar);
  document.addEventListener('opendesk:toggle-versions', () => {
    toggleVersionSidebar(versionSidebar);
  });

  const workflowPanel = buildWorkflowPanel();
  document.body.appendChild(workflowPanel);
  document.addEventListener('opendesk:toggle-workflows', () => {
    toggleWorkflowPanel(workflowPanel);
  });

  const refLibrary = buildReferenceLibrary(editor);
  document.body.appendChild(refLibrary.element);
  document.addEventListener('opendesk:toggle-reference-library', () => {
    refLibrary.toggle();
  });

  setupPromoteToKB(editor);

  document.addEventListener('opendesk:insert-citation', () => {
    const citeBtn = document.querySelector('[data-action="insert-citation"]') as HTMLElement | null;
    const fallback = citeBtn ?? editorEl;
    openCitationPicker(editor, fallback);
  });

  document.addEventListener('opendesk:add-comment', () => {
    showCommentInput(editor, commentStore, documentId, user);
    // Mutually exclusive with the TOC panel
    toggleTocPanel(tocPanel, false);
    toggleSidebar(commentSidebar, true);
    announce(t('a11y.commentAdded'));
  });

  document.addEventListener('opendesk:toggle-suggestions', () => {
    toggleSuggestionSidebar(suggestionSidebar);
  });
}
