/** Contract: contracts/app/comments.md */
import type { Editor } from '@tiptap/core';
import { t } from '../i18n/index.ts';

/** Scroll the editor view to the text marked with the given comment ID. */
export function scrollToComment(editor: Editor, commentId: string): void {
  const markType = editor.state.schema.marks.comment;
  if (!markType) return;

  let targetPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (targetPos !== null) return false;
    for (const mark of node.marks) {
      if (mark.type === markType && mark.attrs.commentId === commentId) {
        targetPos = pos;
        return false;
      }
    }
    return true;
  });

  if (targetPos !== null) {
    editor.chain().focus().setTextSelection(targetPos).run();
    const coords = editor.view.coordsAtPos(targetPos);
    window.scrollTo({
      top: coords.top + window.scrollY - 100,
      behavior: 'smooth',
    });
  }
}

/** Format an ISO date string as a relative time string. */
export function formatCommentTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return t('time.justNow');

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1
      ? t('time.minuteAgo')
      : t('time.minutesAgo', { n: minutes });
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1
      ? t('time.hourAgo')
      : t('time.hoursAgo', { n: hours });
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? t('time.dayAgo') : t('time.daysAgo', { n: days });
}
