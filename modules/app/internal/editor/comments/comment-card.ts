/** Contract: contracts/app/comments.md */
import type { Editor } from '@tiptap/core';
import type { CommentStore } from './comment-store.ts';
import type { CommentData } from './types.ts';
import { t } from '../../i18n/index.ts';
import { renderReplyForm } from './comment-reply.ts';
import { formatCommentTime, scrollToComment } from './comment-utils.ts';

/** Render a single comment card with body, actions, and thread. */
export function renderCommentCard(
  comment: CommentData,
  editor: Editor,
  store: CommentStore,
  user: { name: string; color: string },
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'comment-card';
  if (comment.resolvedAt) card.classList.add('comment-resolved');
  card.setAttribute('data-comment-id', comment.id);

  card.appendChild(buildCommentBody(comment));
  card.appendChild(buildCommentActions(comment, editor, store, user));

  const replies = store.getReplies(comment.id);
  if (replies.length > 0) {
    const thread = document.createElement('div');
    thread.className = 'comment-thread';
    for (const reply of replies) {
      thread.appendChild(buildCommentBody(reply));
    }
    card.appendChild(thread);
  }

  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button, textarea')) return;
    scrollToComment(editor, comment.id);
  });

  return card;
}

function buildCommentBody(comment: CommentData): HTMLElement {
  const body = document.createElement('div');
  body.className = 'comment-body';

  const meta = document.createElement('div');
  meta.className = 'comment-meta';

  const authorEl = document.createElement('span');
  authorEl.className = 'comment-author';
  authorEl.textContent = comment.author;
  authorEl.style.color = comment.authorColor;

  const timeEl = document.createElement('span');
  timeEl.className = 'comment-time';
  timeEl.textContent = formatCommentTime(comment.createdAt);

  meta.appendChild(authorEl);
  meta.appendChild(timeEl);

  const text = document.createElement('p');
  text.className = 'comment-text';
  text.textContent = comment.content;

  body.appendChild(meta);
  body.appendChild(text);
  return body;
}

function buildCommentActions(
  comment: CommentData,
  editor: Editor,
  store: CommentStore,
  user: { name: string; color: string },
): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'comment-actions';

  const replyBtn = document.createElement('button');
  replyBtn.className = 'comment-action-btn';
  replyBtn.textContent = t('comments.reply');
  replyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const card = actions.closest('.comment-card');
    if (!card) return;
    card.querySelector('.comment-reply-form')?.remove();
    card.appendChild(
      renderReplyForm(store, comment.id, comment.documentId, user),
    );
  });

  const resolveBtn = document.createElement('button');
  resolveBtn.className = 'comment-action-btn';
  resolveBtn.textContent = comment.resolvedAt
    ? t('comments.reopen')
    : t('comments.resolve');
  resolveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (comment.resolvedAt) {
      store.reopenComment(comment.id);
    } else {
      store.resolveComment(comment.id);
    }
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'comment-action-btn comment-action-delete';
  deleteBtn.textContent = t('comments.delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    editor.chain().focus().unsetComment(comment.id).run();
    store.deleteComment(comment.id);
  });

  actions.appendChild(replyBtn);
  actions.appendChild(resolveBtn);
  actions.appendChild(deleteBtn);
  return actions;
}
