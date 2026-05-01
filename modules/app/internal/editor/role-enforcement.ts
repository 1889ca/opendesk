/** Contract: contracts/app/rules.md */

/**
 * Role enforcement for shared document views.
 *
 * When a document is opened via a share link, the server response includes
 * the role granted by that link. This module reads the role from the URL
 * param (?role=viewer|commenter|editor) and enforces it on the TipTap
 * editor and toolbar.
 *
 * Role behaviour:
 *   viewer    — read-only, no toolbar, no editing of any kind
 *   commenter — cannot edit document content; can add comments via the comment sidebar
 *   editor    — full access (default behaviour, no restrictions applied)
 */

import type { Editor } from '@tiptap/core';

export type SharedRole = 'viewer' | 'commenter' | 'editor';

/**
 * Read the shared role from the current URL query string.
 * Returns null if no role param is present (i.e., not a shared view).
 */
export function getSharedRole(): SharedRole | null {
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role');
  if (role === 'viewer' || role === 'commenter' || role === 'editor') {
    return role;
  }
  return null;
}

/**
 * Apply role-based restrictions to the editor and toolbar.
 *
 * Called once after editor initialisation when the document was opened
 * via a share link. Safe to call with role = 'editor' (no-op).
 */
export function applyRoleEnforcement(editor: Editor, role: SharedRole): void {
  if (role === 'editor') return; // Full access — nothing to restrict.

  console.info('[role-enforcement] Applying share-role restrictions:', role);

  // --- TipTap editability ---
  if (role === 'viewer') {
    // Viewers cannot interact with the document at all.
    editor.setEditable(false);
  } else if (role === 'commenter') {
    // Commenters can read and add comments, but must not be able to modify content.
    editor.setEditable(false);
  }

  // --- Toolbar visibility ---
  const formattingToolbar = document.getElementById('formatting-toolbar');
  if (formattingToolbar) {
    if (role === 'viewer') {
      formattingToolbar.hidden = true;
      formattingToolbar.setAttribute('aria-hidden', 'true');
    } else if (role === 'commenter') {
      // Commenters see a disabled (but visible) toolbar so they understand
      // the document is read-only while still being able to use the comment sidebar.
      formattingToolbar.setAttribute('data-role', 'commenter');
      disableToolbarButtons(formattingToolbar);
    }
  }

  // Hide the menu bar (hamburger) for viewers entirely.
  const menuBarEl = document.querySelector<HTMLElement>('.menu-bar-hamburger');
  if (menuBarEl && role === 'viewer') {
    menuBarEl.hidden = true;
    menuBarEl.setAttribute('aria-hidden', 'true');
  }

  // Add a visible read-only banner so users understand why they cannot edit.
  mountReadOnlyBanner(role);
}

/**
 * Disable all interactive buttons in a toolbar element.
 * Used for commenter role where the toolbar is visible but non-functional.
 */
function disableToolbarButtons(toolbar: HTMLElement): void {
  const buttons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button, select, input'));
  for (const btn of buttons) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
  }
}

/**
 * Mount a small, non-intrusive banner indicating the document is read-only.
 * Appended once to the status bar region or as a floating badge.
 */
function mountReadOnlyBanner(role: SharedRole): void {
  if (document.getElementById('role-enforcement-banner')) return; // already mounted

  const label = role === 'viewer' ? 'View only' : 'Comment only';

  const banner = document.createElement('div');
  banner.id = 'role-enforcement-banner';
  banner.className = 'role-enforcement-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-label', `Shared document: ${label}`);
  banner.textContent = label;

  // Try to place it in the toolbar-right; fall back to body.
  const toolbarRight = document.querySelector('.toolbar-right');
  if (toolbarRight) {
    toolbarRight.insertBefore(banner, toolbarRight.firstChild);
  } else {
    document.body.appendChild(banner);
  }
}
