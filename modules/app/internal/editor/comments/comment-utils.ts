/** Contract: contracts/app/comments.md */
import type { Editor } from '@tiptap/core';
import { formatRelativeTime } from '../../shared/time-format.ts';

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
  return formatRelativeTime(isoDate);
}
