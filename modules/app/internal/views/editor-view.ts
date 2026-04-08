/** Contract: contracts/app/shell.md */

/**
 * Editor view: wraps the TipTap editor for SPA mount/unmount lifecycle.
 * Creates the full editor chrome and tears everything down on unmount.
 */

import { Editor } from '@tiptap/core';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { t } from '../i18n/index.ts';
import { buildLanguageSwitcher, updateStaticText } from '../locale-ui.ts';
import { buildTableToolbar } from '../table-toolbar.ts';
import { setupImageHandlers } from '../image-handlers.ts';
import { buildSearchPanel } from '../search/search-panel.ts';
import { buildFormattingToolbar } from '../formatting-toolbar.ts';
import { CommentStore } from '../comments/index.ts';
import { setSuggestUser, createSuggestModePlugin, setupSuggestionClickHandler } from '../suggestions/index.ts';
import { bindShortcutDialogKey } from '../shortcut-dialog.ts';
import { initTouchSupport } from '../touch-support.ts';
import { buildStatusBar } from '../status-bar.ts';
import { buildThemeToggle } from '../theme-toggle.ts';
import { openEmojiPicker } from '../emoji/index.ts';
import { setupCodeBlockUI } from '../code-block-ui.ts';
import { buildEditorExtensions } from '../editor-extensions.ts';
import { apiFetch } from '../api-client.ts';
import { navigate } from '../shell/router.ts';
import { buildEditorToolbar } from './editor-toolbar.ts';
import { mountSidebars } from './editor-sidebars.ts';

const COLORS = [
  '#958DF1', '#F98181', '#FBBC88', '#FAF594',
  '#70CFF8', '#94FADB', '#B9F18D', '#C3E2C2',
];

let editor: Editor | null = null;
let provider: HocuspocusProvider | null = null;
let ydoc: Y.Doc | null = null;
let cleanupFns: (() => void)[] = [];

function getUserIdentity() {
  let name = localStorage.getItem('opendesk:userName');
  let color = localStorage.getItem('opendesk:userColor');
  if (!name) {
    const defaults = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank'];
    name = defaults[Math.floor(Math.random() * defaults.length)];
    localStorage.setItem('opendesk:userName', name);
  }
  if (!color) {
    color = COLORS[Math.floor(Math.random() * COLORS.length)];
    localStorage.setItem('opendesk:userColor', color);
  }
  return { name, color };
}

export async function mount(container: HTMLElement, params: Record<string, string>): Promise<void> {
  const documentId = params.id || 'default';
  cleanupFns = [];
  initTouchSupport();
  const user = getUserIdentity();

  // Build editor chrome
  const { toolbarEl, statusEl, usersEl, titleInput } = buildEditorToolbar(documentId);
  container.appendChild(toolbarEl);

  const formattingToolbar = document.createElement('div');
  formattingToolbar.id = 'formatting-toolbar';
  formattingToolbar.className = 'formatting-toolbar';
  container.appendChild(formattingToolbar);

  const editorWrapper = document.createElement('main');
  editorWrapper.className = 'editor-wrapper';
  editorWrapper.setAttribute('role', 'main');
  editorWrapper.setAttribute('aria-label', 'Document editor');

  const editorEl = document.createElement('div');
  editorEl.id = 'editor';
  editorWrapper.appendChild(editorEl);
  container.appendChild(editorWrapper);

  loadDocTitle(documentId, titleInput);

  // Set up collab
  ydoc = new Y.Doc();
  const commentStore = new CommentStore(ydoc);
  const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/collab`;
  provider = new HocuspocusProvider({
    url: wsUrl, name: documentId, document: ydoc, token: 'dev',
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

  const onEmoji = () => {
    const emojiBtn = document.querySelector('[data-i18n-key="toolbar.emoji"]') as HTMLElement | null;
    if (emojiBtn && editor) openEmojiPicker(editor, emojiBtn);
  };
  document.addEventListener('opendesk:open-emoji', onEmoji);
  cleanupFns.push(() => document.removeEventListener('opendesk:open-emoji', onEmoji));

  editorWrapper.appendChild(buildStatusBar(editor));

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
