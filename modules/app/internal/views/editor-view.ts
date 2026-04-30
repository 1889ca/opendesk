/** Contract: contracts/app/shell.md */

/**
 * Editor view: wraps the TipTap editor for SPA mount/unmount lifecycle.
 * Creates the full editor chrome and tears everything down on unmount.
 */

import { Editor } from '@tiptap/core';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { t } from '../i18n/index.ts';
import { buildLanguageSwitcher, updateStaticText } from '../shared/locale-ui.ts';
import { buildTableToolbar } from '../editor/table-toolbar.ts';
import { setupImageHandlers } from '../editor/image-handlers.ts';
import { buildSearchPanel } from '../editor/search/search-panel.ts';
import { buildFormattingToolbar } from '../editor/formatting-toolbar.ts';
import { CommentStore } from '../editor/comments/index.ts';
import { setSuggestUser, createSuggestModePlugin, setupSuggestionClickHandler } from '../editor/suggestions/index.ts';
import { bindShortcutDialogKey } from '../shared/shortcut-dialog.ts';
import { initTouchSupport } from '../shared/touch-support.ts';
import { buildStatusBar } from '../editor/status-bar.ts';
import { buildThemeToggle } from '../shared/theme-toggle.ts';
import { openEmojiPicker } from '../editor/emoji/index.ts';
import { setupCodeBlockUI } from '../editor/code-block-ui.ts';
import { buildEditorExtensions } from '../editor/editor-extensions.ts';
import { apiFetch, getAuthToken } from '../shared/api-client.ts';
import { navigate } from '../shell/router.ts';
import { buildEditorToolbar } from './editor-toolbar.ts';
import { mountSidebars } from './editor-sidebars.ts';
import { getUserIdentity } from '../shared/identity.ts';
import { fetchMyRole, applyPermissionMode } from './editor-view-permissions.ts';

let editor: Editor | null = null;
let provider: HocuspocusProvider | null = null;
let ydoc: Y.Doc | null = null;
let cleanupFns: (() => void)[] = [];

export async function mount(container: HTMLElement, params: Record<string, string>): Promise<void> {
  const documentId = params.id || 'default';
  cleanupFns = [];
  initTouchSupport();
  const user = getUserIdentity();

  // Build editor chrome
  const { toolbarEl, statusEl, usersEl, titleInput } = buildEditorToolbar(documentId);
  container.appendChild(toolbarEl);

  // Unified toolbar: menu bar + formatting bar in one row
  const unifiedToolbar = document.createElement('div');
  unifiedToolbar.className = 'unified-toolbar';

  const menuBarSlot = document.createElement('div');
  menuBarSlot.id = 'menu-bar';
  unifiedToolbar.appendChild(menuBarSlot);

  const toolbarDivider = document.createElement('div');
  toolbarDivider.className = 'toolbar-divider';
  unifiedToolbar.appendChild(toolbarDivider);

  const formattingToolbar = document.createElement('div');
  formattingToolbar.id = 'formatting-toolbar';
  formattingToolbar.className = 'formatting-toolbar';
  unifiedToolbar.appendChild(formattingToolbar);

  container.appendChild(unifiedToolbar);

  const editorWrapper = document.createElement('main');
  editorWrapper.className = 'editor-wrapper';
  editorWrapper.setAttribute('role', 'main');
  editorWrapper.setAttribute('aria-label', 'Document editor');

  const editorEl = document.createElement('div');
  editorEl.id = 'editor';
  editorWrapper.appendChild(editorEl);
  container.appendChild(editorWrapper);

  loadDocTitle(documentId, titleInput);

  // Fetch permission level before connecting collab so we can set the
  // initial editable state correctly. We do this in parallel with setting
  // up the collab provider because the WS handshake takes time.
  const permPromise = fetchMyRole(documentId);

  // Set up collab. Use the real auth token so the WS authenticate hook
  // sees the same principal as HTTP requests — not the hardcoded 'dev' sentinel.
  ydoc = new Y.Doc();
  const commentStore = new CommentStore(ydoc);
  const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/collab`;
  provider = new HocuspocusProvider({
    url: wsUrl, name: documentId, document: ydoc, token: getAuthToken(),
    onConnect() {
      if (statusEl) { statusEl.textContent = t('status.connected'); statusEl.className = 'status connected'; }
    },
    onDisconnect() {
      if (statusEl) { statusEl.textContent = t('status.disconnected'); statusEl.className = 'status disconnected'; }
    },
  });

  editor = new Editor({
    element: editorEl,
    extensions: buildEditorExtensions({ ydoc, provider, user }),
    editorProps: { attributes: { class: 'editor-content' } },
  });

  setSuggestUser(() => user);
  editor.registerPlugin(createSuggestModePlugin(editor));
  setupSuggestionClickHandler(editor);
  setupCodeBlockUI(editor);
  buildFormattingToolbar(editor);
  buildTableToolbar(editor);
  buildSearchPanel(editor);
  buildLanguageSwitcher();
  buildThemeToggle();
  setupImageHandlers(editor, editorEl);
  bindShortcutDialogKey();

  // Apply permission mode once we know the user's role.
  // We await here (after editor setup) so the editor exists when we configure it.
  const perm = await permPromise;
  applyPermissionMode(editor, formattingToolbar, perm);

  const onEmoji = () => {
    const emojiBtn = document.querySelector('[data-i18n-key="toolbar.emoji"]') as HTMLElement | null;
    if (emojiBtn && editor) openEmojiPicker(editor, emojiBtn);
  };
  document.addEventListener('opendesk:open-emoji', onEmoji);
  cleanupFns.push(() => document.removeEventListener('opendesk:open-emoji', onEmoji));

  const statusBar = buildStatusBar(editor);
  editorWrapper.appendChild(statusBar.el);
  cleanupFns.push(statusBar.cleanup);

  // Mount sidebars
  const sidebarCleanups = mountSidebars({ editor, commentStore, documentId, user, container });
  cleanupFns.push(...sidebarCleanups);

  // Awareness
  function updateUsers() {
    if (!usersEl || !provider?.awareness) return;
    const states = provider.awareness.getStates();
    const names: string[] = [];
    states.forEach((state: { user?: { name?: string } }) => {
      if (state.user?.name) names.push(state.user.name);
    });
    usersEl.textContent = names.join(', ') || '-';
  }
  provider.awareness?.on('change', updateUsers);
  cleanupFns.push(() => provider?.awareness?.off('change', updateUsers));
  updateUsers();

  // Expose for export handlers
  const win = window as unknown as Record<string, unknown>;
  win.editor = editor;
  win.provider = provider;
  win.ydoc = ydoc;
  win.commentStore = commentStore;
}

async function loadDocTitle(docId: string, titleInput: HTMLInputElement): Promise<void> {
  try {
    const res = await apiFetch('/api/documents/' + encodeURIComponent(docId));
    if (!res.ok) { navigate('/'); return; }
    const doc = await res.json();
    titleInput.value = doc.title || 'Untitled';
    document.title = doc.title + ' - OpenDesk';
  } catch {
    navigate('/');
  }
}

export function unmount(): void {
  for (const fn of cleanupFns) fn();
  cleanupFns = [];

  if (editor) { editor.destroy(); editor = null; }
  if (provider) { provider.destroy(); provider = null; }
  if (ydoc) { ydoc.destroy(); ydoc = null; }

  const win = window as unknown as Record<string, unknown>;
  delete win.editor;
  delete win.provider;
  delete win.ydoc;
  delete win.commentStore;
}
