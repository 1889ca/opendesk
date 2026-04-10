/** Contract: contracts/app/shell.md */
/**
 * Permission mode helpers: fetch the current user's document role and apply
 * read-only / comment-only constraints to the editor and toolbar.
 * Extracted from editor-view.ts to keep that file under the 200-line limit.
 */
import type { Editor } from '@tiptap/core';
import { apiFetch } from '../shared/api-client.ts';

/** Fetch the current user's role on a document. Returns null on error. */
export async function fetchMyRole(documentId: string): Promise<{ role: string; canWrite: boolean; canComment: boolean } | null> {
  try {
    const res = await apiFetch(`/api/documents/${encodeURIComponent(documentId)}/my-role`);
    if (!res.ok) return null;
    return res.json() as Promise<{ role: string; canWrite: boolean; canComment: boolean }>;
  } catch {
    return null;
  }
}

/** Apply read-only or comment-only mode to the editor and toolbar. */
export function applyPermissionMode(
  editorInstance: Editor,
  formattingToolbarEl: HTMLElement,
  perm: { canWrite: boolean; canComment: boolean } | null,
): void {
  const canWrite = perm?.canWrite ?? true; // fail open only in case of fetch error
  const canComment = perm?.canComment ?? true;

  if (!canWrite) {
    editorInstance.setEditable(false);

    // Hide or disable the formatting toolbar for viewers and commenters.
    // Commenters can add comments via the sidebar; the toolbar is for editing only.
    formattingToolbarEl.hidden = true;
    formattingToolbarEl.setAttribute('aria-hidden', 'true');

    // Show a read-only banner above the editor.
    const banner = document.createElement('div');
    banner.className = 'permission-banner';
    banner.setAttribute('role', 'status');
    banner.textContent = canComment
      ? 'You can view and comment on this document.'
      : 'You have read-only access to this document.';
    const parent = formattingToolbarEl.parentElement;
    if (parent) {
      parent.insertBefore(banner, formattingToolbarEl.nextSibling);
    }
  }
}
