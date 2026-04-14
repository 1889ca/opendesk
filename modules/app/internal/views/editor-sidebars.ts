/** Contract: contracts/app/shell.md */

/**
 * Mounts editor sidebars (comments, suggestions, TOC, versions)
 * and wires up their event listeners. Returns cleanup functions.
 */

import type { Editor } from '@tiptap/core';
import { t } from '../i18n/index.ts';
import { CommentStore, buildCommentSidebar, toggleSidebar, showCommentInput } from '../editor/comments/index.ts';
import { buildSuggestionSidebar, toggleSuggestionSidebar } from '../editor/suggestions/index.ts';
import { buildTocPanel, toggleTocPanel } from '../editor/toc/index.ts';
import { buildVersionSidebar, toggleVersionSidebar } from '../editor/version-history.ts';
import { announce } from '../shared/a11y-announcer.ts';

interface SidebarsInput {
  editor: Editor;
  commentStore: CommentStore;
  documentId: string;
  user: { name: string; color: string };
  container: HTMLElement;
}

/**
 * Attach all sidebar panels to the container and return cleanup functions.
 */
export function mountSidebars(input: SidebarsInput): (() => void)[] {
  const { editor, commentStore, documentId, user, container } = input;
  const cleanups: (() => void)[] = [];

  const commentSidebar = buildCommentSidebar(editor, commentStore, documentId, user);
  container.appendChild(commentSidebar);

  const suggestionSidebar = buildSuggestionSidebar(editor);
  container.appendChild(suggestionSidebar);

  const toc = buildTocPanel(editor);
  container.appendChild(toc.el);

  const versionSidebar = buildVersionSidebar();
  container.appendChild(versionSidebar);

  const onToggleToc = () => toggleTocPanel(toc.el);
  const onToggleVersions = () => toggleVersionSidebar(versionSidebar);
  const onAddComment = () => {
    showCommentInput(editor, commentStore, documentId, user);
    toggleSidebar(commentSidebar, true);
    announce(t('a11y.commentAdded'));
  };
  const onToggleSuggestions = () => toggleSuggestionSidebar(suggestionSidebar);

  document.addEventListener('opendesk:toggle-toc', onToggleToc);
  document.addEventListener('opendesk:toggle-versions', onToggleVersions);
  document.addEventListener('opendesk:add-comment', onAddComment);
  document.addEventListener('opendesk:toggle-suggestions', onToggleSuggestions);

  cleanups.push(
    toc.cleanup,
    () => document.removeEventListener('opendesk:toggle-toc', onToggleToc),
    () => document.removeEventListener('opendesk:toggle-versions', onToggleVersions),
    () => document.removeEventListener('opendesk:add-comment', onAddComment),
    () => document.removeEventListener('opendesk:toggle-suggestions', onToggleSuggestions),
  );

  return cleanups;
}
