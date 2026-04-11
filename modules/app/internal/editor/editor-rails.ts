/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { type CommentStore, buildCommentsBlock } from './comments/index.ts';
import { buildSuggestionsBlock } from './suggestions/index.ts';
import { buildPanelRail } from './panel-system.ts';
import { buildStylesBlock, buildLayoutBlock } from './panel-blocks.ts';
import { buildTocBlock } from './toc/toc-block.ts';
import { buildVersionsBlock } from './version-block.ts';
import { buildWorkflowsBlock } from './workflow-block.ts';
import { buildReferenceBlock } from './citations/reference-block.ts';
import { buildSpecialCharsBlock } from './special-chars-block.ts';

interface RailDeps {
  editor: Editor;
  commentStore: CommentStore;
  documentId: string;
  user: { name: string; color: string };
}

export function mountEditorRails(deps: RailDeps): void {
  const { editor, commentStore, documentId, user } = deps;
  const editorBody = document.querySelector('.editor-body');
  if (!editorBody) return;

  const leftRail = buildPanelRail('left', [
    buildTocBlock(editor),
    buildSpecialCharsBlock(editor),
    buildReferenceBlock(editor),
  ]);

  const rightRail = buildPanelRail('right', [
    buildStylesBlock(editor),
    buildLayoutBlock(editor),
    buildCommentsBlock(editor, commentStore, documentId, user),
    buildSuggestionsBlock(editor),
    buildVersionsBlock(),
    buildWorkflowsBlock(),
  ]);

  const editorWrapper = editorBody.querySelector('.editor-wrapper');
  editorBody.insertBefore(leftRail.el, editorWrapper);
  editorBody.appendChild(rightRail.el);

  document.addEventListener('opendesk:toggle-panels', () => rightRail.toggle());
  document.addEventListener('opendesk:toggle-toc', () => leftRail.toggle());
}
