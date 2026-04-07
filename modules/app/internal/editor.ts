/** Contract: contracts/app/rules.md */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { t, setLocale, getLocale, resolveLocale, persistLocale, onLocaleChange } from './i18n/index.ts';
import { buildLanguageSwitcher, updateStaticText } from './locale-ui.ts';
import { buildTableToolbar } from './table-toolbar.ts';
import { setupImageHandlers } from './image-handlers.ts';
import { SearchExtension } from './search/search-extension.ts';
import { buildSearchPanel } from './search/search-panel.ts';
import { buildFormattingToolbar } from './formatting-toolbar.ts';
import { CommentMark, CommentStore, buildCommentSidebar, toggleSidebar, showCommentInput } from './comments/index.ts';
import { PageBreak } from './page-break.ts';
import {
  SuggestionInsertMark,
  SuggestionDeleteMark,
  setSuggestUser,
  createSuggestModePlugin,
  setupSuggestionClickHandler,
  buildSuggestionSidebar,
  toggleSuggestionSidebar,
} from './suggestions/index.ts';
import { bindShortcutDialogKey } from './shortcut-dialog.ts';
import { announce } from './a11y-announcer.ts';
import { initTouchSupport } from './touch-support.ts';
import { buildVersionSidebar, toggleVersionSidebar } from './version-history.ts';
import { buildStatusBar } from './status-bar.ts';

const COLORS = [
  '#958DF1', '#F98181', '#FBBC88', '#FAF594',
  '#70CFF8', '#94FADB', '#B9F18D', '#C3E2C2',
];

function getUserIdentity() {
  let name = localStorage.getItem('opendesk:userName');
  let color = localStorage.getItem('opendesk:userColor');
  if (!name) {
    const defaultNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank'];
    name = defaultNames[Math.floor(Math.random() * defaultNames.length)];
    localStorage.setItem('opendesk:userName', name);
  }
  if (!color) {
    color = COLORS[Math.floor(Math.random() * COLORS.length)];
    localStorage.setItem('opendesk:userColor', color);
  }
  return { name, color };
}

function getDocumentId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('doc') || 'default';
}

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

function init() {
  initTouchSupport();

  const locale = resolveLocale();
  setLocale(locale);
  persistLocale(locale);
  updateHtmlLang();
  onLocaleChange(updateHtmlLang);
  addSkipLink();

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
  const provider = new HocuspocusProvider({
    url: wsUrl, name: documentId, document: ydoc,
    onConnect() {
      if (statusEl) { statusEl.textContent = t('status.connected'); statusEl.className = 'status connected'; }
    },
    onDisconnect() {
      if (statusEl) { statusEl.textContent = t('status.disconnected'); statusEl.className = 'status disconnected'; }
    },
  });

  const editor = new Editor({
    element: editorEl,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        inline: false,
        allowBase64: false,
        resize: { enabled: true, minWidth: 100, minHeight: 50 },
      }),
      SearchExtension,
      PageBreak,
      CommentMark,
      SuggestionInsertMark,
      SuggestionDeleteMark,
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({ provider, user: { name: user.name, color: user.color } }),
    ],
    editorProps: { attributes: { class: 'editor-content' } },
  });

  // Suggestion mode setup
  setSuggestUser(() => user);
  editor.registerPlugin(createSuggestModePlugin(editor));
  setupSuggestionClickHandler(editor);

  buildFormattingToolbar(editor);
  buildTableToolbar(editor);
  buildSearchPanel(editor);
  buildLanguageSwitcher();
  setupImageHandlers(editor, editorEl);
  bindShortcutDialogKey();

  // Status bar (word count & stats)
  const editorWrapper = editorEl.closest('.editor-wrapper');
  if (editorWrapper) {
    editorWrapper.appendChild(buildStatusBar(editor));
  }

  // Comment sidebar
  const commentSidebar = buildCommentSidebar(editor, commentStore, documentId, user);
  document.body.appendChild(commentSidebar);

  // Suggestion sidebar
  const suggestionSidebar = buildSuggestionSidebar(editor);
  document.body.appendChild(suggestionSidebar);

  // Version history sidebar
  const versionSidebar = buildVersionSidebar();
  document.body.appendChild(versionSidebar);
  document.addEventListener('opendesk:toggle-versions', () => {
    toggleVersionSidebar(versionSidebar);
  });

  document.addEventListener('opendesk:add-comment', () => {
    showCommentInput(editor, commentStore, documentId, user);
    toggleSidebar(commentSidebar, true);
    announce(t('a11y.commentAdded'));
  });

  // Listen for suggestion sidebar toggle
  document.addEventListener('opendesk:toggle-suggestions', () => {
    toggleSuggestionSidebar(suggestionSidebar);
  });

  function updateUsers() {
    if (!usersEl || !provider.awareness) return;
    const states = provider.awareness.getStates();
    const names: string[] = [];
    states.forEach((state: { user?: { name?: string } }) => {
      if (state.user?.name) names.push(state.user.name);
    });
    usersEl.textContent = names.join(', ') || '-';
  }
  provider.awareness?.on('change', updateUsers);
  updateUsers();
  Object.assign(window, { editor, provider, ydoc, commentStore });
}

document.addEventListener('DOMContentLoaded', init);
