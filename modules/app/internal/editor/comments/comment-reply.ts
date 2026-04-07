/** Contract: contracts/app/comments.md */
import type { CommentStore } from './comment-store.ts';
import { t } from '../../i18n/index.ts';

/**
 * Renders an inline reply form inside a comment card.
 * Returns the form element to be appended to the card.
 */
export function renderReplyForm(
  store: CommentStore,
  parentId: string,
  documentId: string,
  user: { name: string; color: string },
): HTMLElement {
  const form = document.createElement('div');
  form.className = 'comment-reply-form';

  const textarea = document.createElement('textarea');
  textarea.className = 'comment-reply-textarea';
  textarea.placeholder = t('comments.replyPlaceholder');
  textarea.rows = 2;

  const actions = document.createElement('div');
  actions.className = 'comment-reply-actions';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn btn-primary comment-reply-submit';
  submitBtn.textContent = t('comments.reply');

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn comment-reply-cancel';
  cancelBtn.textContent = t('comments.cancel');

  const submit = () => {
    const content = textarea.value.trim();
    if (!content) return;
    store.addReply(parentId, {
      id: crypto.randomUUID(),
      documentId,
      content,
      author: user.name,
      authorColor: user.color,
    });
    form.remove();
  };

  submitBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    submit();
  });

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    form.remove();
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') form.remove();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(submitBtn);
  form.appendChild(textarea);
  form.appendChild(actions);

  // Focus after render
  requestAnimationFrame(() => textarea.focus());

  return form;
}
