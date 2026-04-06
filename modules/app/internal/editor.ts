/** Contract: contracts/app/rules.md */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import { HocuspocusProvider } from '@hocuspocus/provider';
// Cursor plugin deferred — y-prosemirror has a ProseMirror version mismatch with TipTap 3.x
import * as Y from 'yjs';

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

  const buttons: Array<{ label: string; action: () => boolean; isActive?: () => boolean }> = [
    { label: 'B', action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold') },
    { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic') },
    { label: 'S', action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike') },
    { label: 'Code', action: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive('code') },
    { label: '---', action: () => false }, // separator
    { label: 'H1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive('heading', { level: 1 }) },
    { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive('heading', { level: 2 }) },
    { label: 'H3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive('heading', { level: 3 }) },
    { label: '---', action: () => false }, // separator
    { label: 'List', action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
    { label: '1.', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
    { label: 'Quote', action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote') },
    { label: '<>', action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock') },
    { label: 'HR', action: () => editor.chain().focus().setHorizontalRule().run() },
  ];

  buttons.forEach(({ label, action, isActive }) => {
    if (label === '---') {
      const sep = document.createElement('span');
      sep.className = 'toolbar-separator';
      toolbar.appendChild(sep);
      return;
    }
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.textContent = label;
    btn.addEventListener('click', (e) => { e.preventDefault(); action(); });
    toolbar.appendChild(btn);

    if (isActive) {
      editor.on('selectionUpdate', () => {
        btn.classList.toggle('is-active', isActive());
      });
      editor.on('transaction', () => {
        btn.classList.toggle('is-active', isActive());
      });
    }
  });
}

function init() {
  const editorEl = document.getElementById('editor');
  if (!editorEl) return;

  const documentId = getDocumentId();
  const user = getUserIdentity();

  const statusEl = document.getElementById('status');
  const usersEl = document.getElementById('users');

  const ydoc = new Y.Doc();

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/collab`;
  const provider = new HocuspocusProvider({
    url: wsUrl,
    name: documentId,
    document: ydoc,
    onConnect() {
      if (statusEl) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'status connected';
      }
    },
    onDisconnect() {
      if (statusEl) {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'status disconnected';
      }
    },
  });

  const editor = new Editor({
    element: editorEl,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc }),
    ],
    editorProps: {
      attributes: { class: 'editor-content' },
    },
  });

  // Set awareness user info (used by user list, cursors deferred to Phase 2)
  if (provider.awareness) {
    provider.awareness.setLocalStateField('user', {
      name: user.name,
      color: user.color,
    });
  }

  buildToolbar(editor);

  // Update user list from awareness
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
