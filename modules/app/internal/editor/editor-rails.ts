/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { type CommentStore, buildCommentsBlock } from './comments/index.ts';
import { buildSuggestionsBlock } from './suggestions/index.ts';
import { buildPanelRail, type PanelBlock } from './panel-system.ts';
import { buildStylesBlock, buildLayoutBlock } from './panel-blocks.ts';
import { buildTocBlock } from './toc/toc-block.ts';
import { buildVersionsBlock } from './version-block.ts';

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

  const stylesLayout = buildStylesLayoutBlock(editor);

  const rail = buildPanelRail([
    buildTocBlock(editor),
    buildCommentsBlock(editor, commentStore, documentId, user),
    buildSuggestionsBlock(editor),
    buildVersionsBlock(),
    stylesLayout,
  ]);

  editorBody.appendChild(rail.el);

  // Generic toggle opens/closes the whole rail
  document.addEventListener('opendesk:toggle-panels', () => rail.toggle());

  // Per-tab toggles open the specific tab
  document.addEventListener('opendesk:toggle-toc', () => rail.showTab('toc'));
  document.addEventListener('opendesk:toggle-suggestions', () => rail.showTab('suggestions'));
  document.addEventListener('opendesk:toggle-versions', () => rail.showTab('versions'));
}

/** Combine Styles + Layout into one panel block. */
function buildStylesLayoutBlock(editor: Editor): PanelBlock {
  const styles = buildStylesBlock(editor);
  const layout = buildLayoutBlock(editor);

  const content = document.createElement('div');
  content.className = 'panel-block-fields';

  const stylesSection = document.createElement('div');
  stylesSection.className = 'panel-combined-section';
  const stylesLabel = document.createElement('h4');
  stylesLabel.className = 'panel-combined-label';
  stylesLabel.textContent = 'Styles';
  stylesSection.append(stylesLabel, styles.content);

  const layoutSection = document.createElement('div');
  layoutSection.className = 'panel-combined-section';
  const layoutLabel = document.createElement('h4');
  layoutLabel.className = 'panel-combined-label';
  layoutLabel.textContent = 'Layout';
  layoutSection.append(layoutLabel, layout.content);

  content.append(stylesSection, layoutSection);

  return {
    id: 'styles-layout',
    title: 'Styles & Layout',
    icon: '\uD83C\uDFA8',
    content,
    cleanup: () => { styles.cleanup?.(); layout.cleanup?.(); },
  };
}
