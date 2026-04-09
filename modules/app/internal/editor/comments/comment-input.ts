/** Contract: contracts/app/comments.md */
import type { Editor } from '@tiptap/core';
import type { CommentStore } from './comment-store.ts';
import { t } from '../../i18n/index.ts';

/**
 * Shows a floating comment input near the current text selection.
 * On submit, creates a comment mark and store entry.
 */
export function showCommentInput(
  editor: Editor,
  store: CommentStore,
  documentId: string,
  user: { name: string; color: string },
): void {
  // Remove any existing input
  hideCommentInput();

  const { from, to, empty } = editor.state.selection;
  if (empty) return;

  const coords = editor.view.coordsAtPos(from);
  const container = document.createElement('div');
  container.className = 'comment-input-popover';
  container.style.top = `${coords.top + window.scrollY + 24}px`;
  container.style.left = `${coords.left}px`;

  const textarea = document.createElement('textarea');
  textarea.className = 'comment-input-text';
  textarea.placeholder = t('comments.placeholder');
  textarea.rows = 2;

  const actions = document.createElement('div');
  actions.className = 'comment-input-actions';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn btn-primary comment-input-submit';
  submitBtn.textContent = t('comments.add');

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn comment-input-cancel';
  cancelBtn.textContent = t('comments.cancel');

  actions.appendChild(cancelBtn);
  actions.appendChild(submitBtn);
  container.appendChild(textarea);
  container.appendChild(actions);
  document.body.appendChild(container);

  textarea.focus();

  const submit = () => {
    const content = textarea.value.trim();
    if (!content) return;

    const commentId = crypto.randomUUID();
    store.addComment({
      id: commentId,
      documentId,
      content,
      author: user.name,
      authorColor: user.color,
    });

    // Apply mark to the captured selection range, then restore focus
    editor.chain().setComment(commentId, { from, to }).focus().run();

    hideCommentInput();
  };

  submitBtn.addEventListener('click', submit);
  cancelBtn.addEventListener('click', hideCommentInput);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      hideCommentInput();
    }
  });
}

/** Remove the comment input popover if present. */
export function hideCommentInput(): void {
  const existing = document.querySelector('.comment-input-popover');
  if (existing) existing.remove();
}
