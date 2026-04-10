/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { t } from '../i18n/index.ts';
import { setConnectionState, flushQueue } from '../offline/index.ts';
import { openEmojiPicker } from './emoji/index.ts';
import { showLinkPopover } from './link-popover.ts';
import { buildProfileChip } from '../shared/profile-chip.ts';
import { openShortcutDialog } from '../shared/shortcut-dialog.ts';

export type CollabSetupOptions = {
  editor: Editor;
  editorEl: HTMLElement;
  provider: HocuspocusProvider;
  statusEl: HTMLElement | null;
  usersEl: HTMLElement | null;
  user: { name: string };
};

/**
 * Wire up the HocuspocusProvider status callbacks, awareness-based user list,
 * and editor event listeners for emoji, link popover, and Mod+K shortcut.
 */
export function initEditorCollab(opts: CollabSetupOptions): void {
  const { editor, editorEl, provider, statusEl, usersEl, user } = opts;

  provider.on('connect', () => {
    if (statusEl) { statusEl.textContent = t('status.connected'); statusEl.className = 'status connected'; }
    setConnectionState('syncing');
    flushQueue().then(() => setConnectionState('online')).catch(() => {});
  });

  provider.on('disconnect', () => {
    if (statusEl) { statusEl.textContent = t('status.disconnected'); statusEl.className = 'status disconnected'; }
    setConnectionState('offline');
  });

  function updateUsers(): void {
    if (!usersEl || !provider.awareness) return;
    const usersSection = document.getElementById('users-section');
    const states = provider.awareness.getStates();
    const names: string[] = [];
    states.forEach((state: { user?: { name?: string } }) => {
      if (state.user?.name) names.push(state.user.name);
    });
    const otherNames = names.filter(
      n => n && n.toLowerCase() !== 'anonymous' && n !== user.name
    );
    if (otherNames.length > 0) {
      usersEl.textContent = otherNames.join(', ');
      if (usersSection) usersSection.removeAttribute('hidden');
    } else {
      usersEl.textContent = '';
      if (usersSection) usersSection.setAttribute('hidden', '');
    }
  }

  provider.awareness?.on('change', updateUsers);
  updateUsers();

  // Profile chip — shows user's display name in the toolbar (issue #170)
  const toolbarRightEl = document.querySelector('.toolbar-right');
  if (toolbarRightEl) {
    toolbarRightEl.appendChild(buildProfileChip());
  }

  // Shortcut help button — header location (issue #225)
  const toolbarRightForShortcut = document.querySelector('.toolbar-right');
  if (toolbarRightForShortcut) {
    const sep = document.createElement('span');
    sep.className = 'toolbar-separator';
    const helpBtn = document.createElement('button');
    helpBtn.className = 'btn btn-ghost btn-sm shortcut-help-btn';
    helpBtn.setAttribute('aria-label', t('a11y.shortcutsLabel'));
    helpBtn.setAttribute('title', t('shortcuts.showShortcuts'));
    helpBtn.textContent = '?';
    helpBtn.addEventListener('click', (e) => { e.preventDefault(); openShortcutDialog(); });
    toolbarRightForShortcut.appendChild(sep);
    toolbarRightForShortcut.appendChild(helpBtn);
  }

  document.addEventListener('opendesk:open-emoji', () => {
    const emojiBtn = document.querySelector('[data-i18n-key="toolbar.emoji"]') as HTMLElement | null;
    if (emojiBtn) openEmojiPicker(editor, emojiBtn);
  });

  document.addEventListener('opendesk:open-link-popover', (e) => {
    const detail = (e as CustomEvent<{ anchor?: HTMLButtonElement }>).detail;
    let anchor = detail?.anchor as HTMLElement | null | undefined;
    if (!anchor) {
      anchor = document.querySelector('[data-i18n-key="toolbar.link"]') as HTMLElement | null;
    }
    if (!anchor) {
      anchor = editorEl;
    }
    showLinkPopover(editor, anchor!);
  });

  document.addEventListener('keydown', (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod && e.key === 'k' && !e.shiftKey && !e.altKey) {
      const sel = editor.state.selection;
      if (!sel.empty || editor.isActive('link')) {
        e.preventDefault();
        const linkBtn = document.querySelector('[data-i18n-key="toolbar.link"]') as HTMLElement | null;
        const anchor = linkBtn ?? editorEl;
        showLinkPopover(editor, anchor);
      }
    }
  });
}
