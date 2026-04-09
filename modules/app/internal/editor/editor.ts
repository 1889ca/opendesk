/** Contract: contracts/app/rules.md */
import { Editor } from '@tiptap/core';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { t, setLocale, getLocale, resolveLocale, persistLocale, onLocaleChange } from '../i18n/index.ts';
import { buildLanguageSwitcher, updateStaticText } from '../shared/locale-ui.ts';
import { buildTableToolbar } from './table-toolbar.ts';
import { setupImageHandlers } from './image-handlers.ts';
import { buildSearchPanel } from './search/search-panel.ts';
import { buildFormattingToolbar } from './formatting-toolbar.ts';
import { buildBubbleMenu } from './bubble-menu.ts';
import { CommentStore } from './comments/index.ts';
import {
  setSuggestUser,
  createSuggestModePlugin,
  setupSuggestionClickHandler,
} from './suggestions/index.ts';
import { bindShortcutDialogKey, openShortcutDialog } from '../shared/shortcut-dialog.ts';
import { initTouchSupport } from '../shared/touch-support.ts';
import { buildThemeToggle } from '../shared/theme-toggle.ts';
import { buildNotificationBell } from '../shared/notification-bell.ts';
import { trackRecentDoc } from '../shared/workspace-sidebar.ts';
import { openEmojiPicker } from './emoji/index.ts';
import { showLinkPopover } from './link-popover.ts';
import { setupCodeBlockUI } from './code-block-ui.ts';
import { buildEditorExtensions } from './editor-extensions.ts';
import { initEntityMentionClicks } from './entity-mentions/index.ts';
import { getUserIdentity, getDocumentId } from '../shared/identity.ts';
import { ensureNameConfirmed } from '../shared/name-setup.ts';
import { buildProfileChip } from '../shared/profile-chip.ts';
import { initEditorPage } from './editor-page.ts';
import { initEditorPanels } from './editor-panels.ts';
import { initRuler } from './editor-ruler.ts';
import { initZoomControl } from './zoom-control.ts';
import { buildSaveIndicator } from './save-indicator.ts';
import { initPageSetup, showPageSetupDialog } from './page-setup.ts';
import {
  registerServiceWorker,
  buildOfflineIndicator,
  buildUpdateBanner,
  initConnectivityListeners,
  setConnectionState,
  flushQueue,
} from '../offline/index.ts';
import { mountAppToolbar } from '../shared/app-toolbar.ts';

function updateHtmlLang(): void {
  document.documentElement.lang = getLocale();
}

function addSkipLink(): void {
  if (document.getElementById('skip-link')) return;
  const link = document.createElement('a');
  link.id = 'skip-link';
  link.href = '#editor';
  link.className = 'skip-to-content';
  link.textContent = t('a11y.skipToContent');
  document.body.insertBefore(link, document.body.firstChild);
  onLocaleChange(() => { link.textContent = t('a11y.skipToContent'); });
}

async function init() {
  initTouchSupport();
  initConnectivityListeners();
  registerServiceWorker();

  const locale = resolveLocale();
  setLocale(locale);
  persistLocale(locale);
  updateHtmlLang();
  onLocaleChange(updateHtmlLang);
  addSkipLink();

  // Block until user has set a display name (issue #170)
  await ensureNameConfirmed();

  const editorEl = document.getElementById('editor');
  if (!editorEl) return;
  const documentId = getDocumentId();
  const user = getUserIdentity();
  const statusEl = document.getElementById('status');
  const usersEl = document.getElementById('users');

  updateStaticText(statusEl);
  onLocaleChange(() => updateStaticText(statusEl));

  const ydoc = new Y.Doc();
  const commentStore = new CommentStore(ydoc);
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/collab`;
  // Offline UI
  const toolbarRight = document.querySelector('.toolbar-right');
  if (toolbarRight) {
    const offlineEl = buildOfflineIndicator();
    toolbarRight.insertBefore(offlineEl, toolbarRight.firstChild);
  }
  document.body.insertBefore(buildUpdateBanner(), document.body.firstChild);

  // Show connecting state immediately, before the WS handshake completes
  if (statusEl) { statusEl.textContent = t('status.connecting'); statusEl.className = 'status connecting'; }

  const provider = new HocuspocusProvider({
    url: wsUrl, name: documentId, document: ydoc, token: 'dev',
    onConnect() {
      if (statusEl) { statusEl.textContent = t('status.connected'); statusEl.className = 'status connected'; }
      setConnectionState('syncing');
      flushQueue().then(() => setConnectionState('online')).catch(() => {});
    },
    onDisconnect() {
      if (statusEl) { statusEl.textContent = t('status.disconnected'); statusEl.className = 'status disconnected'; }
      setConnectionState('offline');
    },
  });

  let editor: Editor;
  try {
    editor = new Editor({
      element: editorEl,
      extensions: buildEditorExtensions({ ydoc, provider, user }),
      editorProps: { attributes: { class: 'editor-content', spellcheck: 'true' } },
    });
  } catch (err) {
    console.error('Editor initialization failed:', err);
    if (statusEl) {
      statusEl.textContent = 'Editor failed to load';
      statusEl.className = 'status error';
    }
    return;
  }

  setSuggestUser(() => user);
  editor.registerPlugin(createSuggestModePlugin(editor));
  setupSuggestionClickHandler(editor);

  // Allow native context menu — prevent any TipTap extension or parent listener
  // from suppressing right-click (issue #255)
  editorEl.addEventListener('contextmenu', (e) => {
    e.stopPropagation();
  }, { capture: true });

  setupCodeBlockUI(editor);
  initEntityMentionClicks(editorEl);
  buildFormattingToolbar(editor);
  buildBubbleMenu(editor);
  buildTableToolbar(editor);
  buildSearchPanel(editor);
  buildLanguageSwitcher();
  buildThemeToggle();
  buildNotificationBell();

  // Profile chip — shows user's display name in the toolbar (issue #170)
  const toolbarRightEl = document.querySelector('.toolbar-right');
  if (toolbarRightEl) {
    const chip = buildProfileChip();
    toolbarRightEl.appendChild(chip);
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

  // Save indicator — "Saving…" / "Saved" next to doc title
  const toolbarLeft = document.querySelector('.toolbar-left');
  if (toolbarLeft) toolbarLeft.appendChild(buildSaveIndicator(editor));

  trackRecentDoc({ id: documentId, title: 'Document' });
  setupImageHandlers(editor, editorEl);
  bindShortcutDialogKey();

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
      // Fallback: anchor to editor element
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

  initEditorPanels({ editor, editorEl, commentStore, documentId, user });
  initRuler();
  initZoomControl();
  initPageSetup();

  // Wire up the Page Setup button in the toolbar
  document.getElementById('page-setup-btn')?.addEventListener('click', showPageSetupDialog);

  // Apply built-in template if one was stored for this doc via sessionStorage
  const pendingHtml = sessionStorage.getItem(`opendesk-template-${documentId}`);
  if (pendingHtml) {
    sessionStorage.removeItem(`opendesk-template-${documentId}`);
    setTimeout(() => {
      if (editor.isEmpty) {
        editor.commands.setContent(pendingHtml);
      }
    }, 500);
  }

  function updateUsers() {
    if (!usersEl || !provider.awareness) return;
    const usersSection = document.getElementById('users-section');
    const states = provider.awareness.getStates();
    const names: string[] = [];
    states.forEach((state: { user?: { name?: string } }) => {
      if (state.user?.name) names.push(state.user.name);
    });
    // Filter out anonymous/empty entries and the current user's own name
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
  Object.assign(window, { editor, provider, ydoc, commentStore });
}

document.addEventListener('DOMContentLoaded', () => {
  mountAppToolbar({ usersHidden: true });
  initEditorPage();
  init();
});
