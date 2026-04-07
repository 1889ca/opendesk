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
import { t, setLocale, resolveLocale, persistLocale, onLocaleChange } from './i18n/index.ts';
import { buildLanguageSwitcher, updateStaticText } from './locale-ui.ts';
import { buildTableToolbar } from './table-toolbar.ts';
import { setupImageHandlers } from './image-handlers.ts';
import { SearchExtension } from './search/search-extension.ts';
import { buildSearchPanel } from './search/search-panel.ts';
import { buildFormattingToolbar } from './formatting-toolbar.ts';
import { CommentMark, CommentStore, buildCommentSidebar, toggleSidebar, showCommentInput } from './comments/index.ts';

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

function init() {
  const locale = resolveLocale();
  setLocale(locale);
  persistLocale(locale);

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
    url: wsUrl,
    name: documentId,
    document: ydoc,
    onConnect() {
      if (statusEl) {
        statusEl.textContent = t('status.connected');
        statusEl.className = 'status connected';
      }
    },
    onDisconnect() {
      if (statusEl) {
        statusEl.textContent = t('status.disconnected');
        statusEl.className = 'status disconnected';
      }
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
      CommentMark,
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: user.name, color: user.color },
      }),
    ],
    editorProps: {
      attributes: { class: 'editor-content' },
    },
  });

  buildFormattingToolbar(editor);
  buildTableToolbar(editor);
  buildSearchPanel(editor);
  buildLanguageSwitcher();
  setupImageHandlers(editor, editorEl);

  // Comment sidebar
  const sidebar = buildCommentSidebar(editor, commentStore, documentId, user);
  document.body.appendChild(sidebar);

  // Listen for add-comment events (from toolbar button or Cmd+Shift+M)
  document.addEventListener('opendesk:add-comment', () => {
    showCommentInput(editor, commentStore, documentId, user);
    toggleSidebar(sidebar, true);
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
