/** Contract: contracts/app/comments.md */
import type { Editor } from '@tiptap/core';
import type { CommentStore } from './comment-store.ts';
import { t } from '../i18n/index.ts';
import { renderCommentCard } from './comment-card.ts';

/**
 * Builds and manages the comment sidebar panel.
 * Lists all comments for the current document with resolve/reply actions.
 */
export function buildCommentSidebar(
  editor: Editor,
  store: CommentStore,
  documentId: string,
  user: { name: string; color: string },
): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'comment-sidebar';
  sidebar.setAttribute('aria-label', t('comments.sidebarLabel'));

  const header = document.createElement('div');
  header.className = 'comment-sidebar-header';

  const title = document.createElement('h2');
  title.className = 'comment-sidebar-title';
  title.textContent = t('comments.title');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'comment-sidebar-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.title = t('comments.closeSidebar');
  closeBtn.addEventListener('click', () => toggleSidebar(sidebar, false));

  header.appendChild(title);
  header.appendChild(closeBtn);
  sidebar.appendChild(header);

  const list = document.createElement('div');
  list.className = 'comment-sidebar-list';
  sidebar.appendChild(list);

  const render = () => {
    list.innerHTML = '';
    const roots = store.getRootComments(documentId);

    if (roots.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'comment-sidebar-empty';
      empty.textContent = t('comments.noComments');
      list.appendChild(empty);
      return;
    }

    for (const comment of roots) {
      list.appendChild(renderCommentCard(comment, editor, store, user));
    }
  };

  render();
  store.onChange(render);

  return sidebar;
}

/** Toggle the comment sidebar visibility. */
export function toggleSidebar(sidebar: HTMLElement, show?: boolean): void {
  const visible = show ?? !sidebar.classList.contains('comment-sidebar-open');
  sidebar.classList.toggle('comment-sidebar-open', visible);
}
