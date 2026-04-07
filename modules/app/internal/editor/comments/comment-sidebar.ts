/** Contract: contracts/app/comments.md */
import type { Editor } from '@tiptap/core';
import type { CommentStore } from './comment-store.ts';
import { t } from '../../i18n/index.ts';
import { renderCommentCard } from './comment-card.ts';
import { isMobileViewport } from '../../shared/touch-support.ts';

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
  sidebar.setAttribute('role', 'complementary');
  sidebar.setAttribute('aria-label', t('comments.sidebarLabel'));

  const handle = document.createElement('div');
  handle.className = 'comment-sheet-handle';
  sidebar.appendChild(handle);

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
  setupSwipeToDismiss(sidebar, handle);

  return sidebar;
}

/** Toggle the comment sidebar visibility with optional backdrop. */
export function toggleSidebar(sidebar: HTMLElement, show?: boolean): void {
  const visible = show ?? !sidebar.classList.contains('comment-sidebar-open');
  sidebar.classList.toggle('comment-sidebar-open', visible);

  const existingBackdrop = document.querySelector('.comment-sheet-backdrop');
  if (visible && isMobileViewport()) {
    if (!existingBackdrop) {
      const backdrop = document.createElement('div');
      backdrop.className = 'comment-sheet-backdrop is-visible';
      backdrop.addEventListener('click', () => toggleSidebar(sidebar, false));
      document.body.appendChild(backdrop);
    } else {
      existingBackdrop.classList.add('is-visible');
    }
  } else if (existingBackdrop) {
    existingBackdrop.classList.remove('is-visible');
  }
}

/** Attach swipe-down-to-dismiss on the handle element. */
function setupSwipeToDismiss(sidebar: HTMLElement, handle: HTMLElement): void {
  let startY = 0;
  let currentY = 0;
  let dragging = false;

  handle.addEventListener('touchstart', (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startY = touch.clientY;
    currentY = startY;
    dragging = true;
    sidebar.style.transition = 'none';
  }, { passive: true });

  handle.addEventListener('touchmove', (e: TouchEvent) => {
    if (!dragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    currentY = touch.clientY;
    const deltaY = currentY - startY;
    if (deltaY > 0) {
      sidebar.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: true });

  handle.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    sidebar.style.transition = '';
    const deltaY = currentY - startY;
    if (deltaY > 80) {
      toggleSidebar(sidebar, false);
    }
    sidebar.style.transform = '';
  }, { passive: true });
}
