/** Contract: contracts/app/comments.md */
import type { Editor } from '@tiptap/core';
import type { CommentStore } from './comment-store.ts';
import { t } from '../../i18n/index.ts';
import { renderCommentCard } from './comment-card.ts';
import type { PanelBlock } from '../panel-system.ts';

export function buildCommentsBlock(
  editor: Editor,
  store: CommentStore,
  documentId: string,
  user: { name: string; color: string },
): PanelBlock {
  const content = document.createElement('div');
  content.className = 'comments-block-list';

  const render = () => {
    content.innerHTML = '';
    const roots = store.getRootComments(documentId);

    if (roots.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'comments-block-empty';
      empty.textContent = t('comments.noComments');
      content.appendChild(empty);
      return;
    }

    for (const comment of roots) {
      content.appendChild(renderCommentCard(comment, editor, store, user));
    }
  };

  render();
  const unsub = store.onChange(render);

  return {
    id: 'comments',
    title: t('comments.title'),
    icon: '\uD83D\uDCAC',
    content,
    cleanup: unsub,
  };
}
