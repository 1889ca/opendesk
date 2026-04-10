/** Contract: contracts/app/rules.md */
import { apiFetch } from '../shared/api-client.ts';

export type EditorRole = 'owner' | 'editor' | 'commenter' | 'viewer';

const ROLE_HIERARCHY: Record<EditorRole, number> = {
  owner: 4,
  editor: 3,
  commenter: 2,
  viewer: 1,
};

/**
 * Fetch the current principal's effective role on the given document.
 * Falls back to 'viewer' on any error — safest possible default.
 */
export async function fetchMyRole(docId: string): Promise<EditorRole> {
  try {
    const res = await apiFetch(`/api/documents/${encodeURIComponent(docId)}/my-role`);
    if (!res.ok) return 'viewer';
    const data = await res.json() as { role?: string };
    const role = data.role as EditorRole | undefined;
    if (role && role in ROLE_HIERARCHY) return role;
  } catch {
    // Network error or JSON parse failure — fall through.
  }
  return 'viewer';
}

/**
 * Apply DOM-level restrictions based on the principal's role.
 *
 * - owner/editor : full editing, share button visible
 * - commenter    : read-only editor, comment sidebar accessible, share hidden
 * - viewer       : fully read-only, comment sidebar hidden, share hidden
 */
export function applyRoleRestrictions(role: EditorRole): void {
  const canEdit    = role === 'owner' || role === 'editor';
  const canShare   = role === 'owner';
  const canComment = canEdit || role === 'commenter';

  // Formatting toolbar
  const toolbar = document.getElementById('formatting-toolbar') as HTMLElement | null;
  if (toolbar) toolbar.hidden = !canEdit;

  // Share button
  const shareBtn = document.getElementById('share-btn') as HTMLElement | null;
  if (shareBtn) shareBtn.hidden = !canShare;

  // Comment sidebar — hide the open-trigger (the panel itself is lazy-built)
  const commentTrigger = document.querySelector<HTMLElement>('[data-action="toggle-comments"]');
  if (commentTrigger) commentTrigger.hidden = !canComment;

  // Make TipTap editor read-only for non-editors
  if (!canEdit) {
    document.dispatchEvent(
      new CustomEvent('opendesk:set-readonly', { detail: { readonly: true } }),
    );
  }

  // Role badge — shown next to the status indicator for non-owners
  if (role !== 'owner' && role !== 'editor') {
    _insertRoleBadge(role);
  }
}

function _insertRoleBadge(role: EditorRole): void {
  if (document.querySelector('.role-badge')) return; // idempotent

  const label = role === 'viewer' ? 'Viewing' : 'Commenting';

  const badge = document.createElement('span');
  badge.className = 'role-badge';
  badge.textContent = label;
  badge.setAttribute('aria-label', `You are ${label.toLowerCase()} this document`);

  const statusEl = document.getElementById('status');
  if (statusEl?.parentElement) {
    statusEl.parentElement.insertBefore(badge, statusEl);
  } else {
    // Fallback: prepend to toolbar-left
    const toolbarLeft = document.querySelector('.toolbar-left');
    if (toolbarLeft) toolbarLeft.prepend(badge);
  }
}
