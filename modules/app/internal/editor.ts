/** Contract: contracts/app/rules.md */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

const colors = [
  '#958DF1', '#F98181', '#FBBC88', '#FAF594',
  '#70CFF8', '#94FADB', '#B9F18D', '#C3E2C2',
];

function getRandomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomName() {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank'];
  return names[Math.floor(Math.random() * names.length)];
}

function getDocumentId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('doc') || 'default';
}

function init() {
  const documentId = getDocumentId();
  const userName = getRandomName();
  const userColor = getRandomColor();

  // Status indicator
  const statusEl = document.getElementById('status')!;
  const docNameEl = document.getElementById('doc-name')!;
  const usersEl = document.getElementById('users')!;

  docNameEl.textContent = documentId;

  // Yjs document
  const ydoc = new Y.Doc();

  // Connect to Hocuspocus
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/collab`;
  const provider = new HocuspocusProvider({
    url: wsUrl,
    name: documentId,
    document: ydoc,
    onConnect() {
      statusEl.textContent = 'Connected';
      statusEl.className = 'status connected';
    },
    onDisconnect() {
      statusEl.textContent = 'Disconnected';
      statusEl.className = 'status disconnected';
    },
  });

  // TipTap editor
  const editor = new Editor({
    element: document.getElementById('editor')!,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc }),
    ],
    editorProps: {
      attributes: {
        class: 'editor-content',
      },
    },
  });

  // Update user list from awareness
  provider.awareness?.on('change', () => {
    const states = provider.awareness!.getStates();
    const userList: string[] = [];
    states.forEach((state) => {
      if (state.user) {
        userList.push(state.user.name);
      }
    });
    usersEl.textContent = userList.join(', ');
  });

  // Expose for debugging
  Object.assign(window, { editor, provider, ydoc });
}

document.addEventListener('DOMContentLoaded', init);
