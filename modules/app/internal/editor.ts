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
import { openImagePicker, setupImageHandlers } from './image-handlers.ts';

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

function buildToolbar(editor: Editor) {
  const toolbar = document.getElementById('formatting-toolbar');
  if (!toolbar) return;

  const render = () => {
    toolbar.innerHTML = '';
    const buttons = buildToolbarButtons(editor);
    renderToolbarButtons(toolbar, buttons, editor);
  };

  render();
  onLocaleChange(render);
}

function buildToolbarButtons(editor: Editor) {
  return [
    { key: 'toolbar.bold' as const, action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold') },
    { key: 'toolbar.italic' as const, action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic') },
    { key: 'toolbar.strike' as const, action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike') },
    { key: 'toolbar.code' as const, action: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive('code') },
    { key: null, action: () => false },
    { key: 'toolbar.heading1' as const, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive('heading', { level: 1 }) },
    { key: 'toolbar.heading2' as const, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive('heading', { level: 2 }) },
    { key: 'toolbar.heading3' as const, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive('heading', { level: 3 }) },
    { key: null, action: () => false },
    { key: 'toolbar.bulletList' as const, action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
    { key: 'toolbar.orderedList' as const, action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
    { key: 'toolbar.blockquote' as const, action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote') },
    { key: 'toolbar.codeBlock' as const, action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock') },
    { key: 'toolbar.horizontalRule' as const, action: () => editor.chain().focus().setHorizontalRule().run() },
    { key: null, action: () => false },
    { key: 'table.insert' as const, action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { key: 'toolbar.image' as const, action: () => { openImagePicker(editor); return true; } },
  ];
}

function renderToolbarButtons(
  toolbar: HTMLElement,
  buttons: ReturnType<typeof buildToolbarButtons>,
  editor: Editor,
) {
  for (const { key, action, isActive } of buttons) {
    if (key === null) {
      const sep = document.createElement('span');
      sep.className = 'toolbar-separator';
      toolbar.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.textContent = t(key);
    btn.addEventListener('click', (e) => { e.preventDefault(); action(); });
    toolbar.appendChild(btn);

    if (isActive) {
      const update = () => btn.classList.toggle('is-active', isActive());
      editor.on('selectionUpdate', update);
      editor.on('transaction', update);
    }
  }
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

  // Awareness user info is set by CollaborationCursor extension

  buildToolbar(editor);
  buildTableToolbar(editor);
  buildLanguageSwitcher();
  setupImageHandlers(editor, editorEl);

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

  Object.assign(window, { editor, provider, ydoc });
}

document.addEventListener('DOMContentLoaded', init);
