/** Contract: contracts/app/shell.md */

import type { Editor } from '@tiptap/core';
import { apiFetch } from '../shared/api-client.ts';

export interface DocumentPermission {
  role: string;
  canWrite: boolean;
  canComment: boolean;
}

/** Fetch the current user's role on a document. Returns null on error. */
export async function fetchMyRole(documentId: string): Promise<DocumentPermission | null> {
  try {
    const res = await apiFetch(`/api/documents/${encodeURIComponent(documentId)}/my-role`);
    if (!res.ok) return null;
    return res.json() as Promise<DocumentPermission>;
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
  const canWrite = perm?.canWrite ?? true;
  const canComment = perm?.canComment ?? true;

  if (canWrite) return;

  editorInstance.setEditable(false);

  formattingToolbarEl.hidden = true;
  formattingToolbarEl.setAttribute('aria-hidden', 'true');

  const banner = document.createElement('div');
  banner.className = 'permission-banner';
  banner.setAttribute('role', 'status');
  banner.textContent = canComment
    ? 'You can view and comment on this document.'
    : 'You have read-only access to this document.';
  const parent = formattingToolbarEl.parentElement;
  if (parent) parent.insertBefore(banner, formattingToolbarEl.nextSibling);
}
