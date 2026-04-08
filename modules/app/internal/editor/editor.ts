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
import { CommentStore, buildCommentSidebar, toggleSidebar, showCommentInput } from './comments/index.ts';
import {
  setSuggestUser,
  createSuggestModePlugin,
  setupSuggestionClickHandler,
  buildSuggestionSidebar,
  toggleSuggestionSidebar,
} from './suggestions/index.ts';
import { bindShortcutDialogKey } from '../shared/shortcut-dialog.ts';
import { announce } from '../shared/a11y-announcer.ts';
import { initTouchSupport } from '../shared/touch-support.ts';
import { buildTocPanel, toggleTocPanel } from './toc/index.ts';
import { buildVersionSidebar, toggleVersionSidebar } from './version-history.ts';
import { buildWorkflowPanel, toggleWorkflowPanel } from './workflow-panel.ts';
import { buildStatusBar } from './status-bar.ts';
import { buildThemeToggle } from '../shared/theme-toggle.ts';
import { openEmojiPicker } from './emoji/index.ts';
import { openCitationPicker, createBibliography, buildReferenceLibrary } from './citations/index.ts';
import { setupCodeBlockUI } from './code-block-ui.ts';
import { buildEditorExtensions } from './editor-extensions.ts';
import { initEntityMentionClicks } from './entity-mentions/index.ts';
import { getUserIdentity, getDocumentId } from '../shared/identity.ts';
import { initEditorPage } from './editor-page.ts';

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
    url: wsUrl, name: documentId, document: ydoc, token: 'dev',
    onConnect() {
      if (statusEl) { statusEl.textContent = t('status.connected'); statusEl.className = 'status connected'; }
    },
    onDisconnect() {
      if (statusEl) { statusEl.textContent = t('status.disconnected'); statusEl.className = 'status disconnected'; }
    },
  });

  let editor: Editor;
  try {
    editor = new Editor({
      element: editorEl,
      extensions: buildEditorExtensions({ ydoc, provider, user }),
      editorProps: { attributes: { class: 'editor-content' } },
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

  setupCodeBlockUI(editor);
  initEntityMentionClicks(editorEl);
  buildFormattingToolbar(editor);
  buildTableToolbar(editor);
  buildSearchPanel(editor);
  buildLanguageSwitcher();
  buildThemeToggle();
  setupImageHandlers(editor, editorEl);
  bindShortcutDialogKey();

  document.addEventListener('opendesk:open-emoji', () => {
    const emojiBtn = document.querySelector('[data-i18n-key="toolbar.emoji"]') as HTMLElement | null;
    if (emojiBtn) openEmojiPicker(editor, emojiBtn);
  });

  const editorWrapper = editorEl.closest('.editor-wrapper');
  if (editorWrapper) {
    editorWrapper.appendChild(buildStatusBar(editor));
  }

  const bib = createBibliography(editor);
  if (editorWrapper) {
    editorWrapper.appendChild(bib.element);
  } else {
    editorEl.parentElement?.appendChild(bib.element);
  }

  const commentSidebar = buildCommentSidebar(editor, commentStore, documentId, user);
  document.body.appendChild(commentSidebar);

  const suggestionSidebar = buildSuggestionSidebar(editor);
  document.body.appendChild(suggestionSidebar);

  const tocPanel = buildTocPanel(editor);
  document.body.appendChild(tocPanel);
  document.addEventListener('opendesk:toggle-toc', () => {
    toggleTocPanel(tocPanel);
  });

  const versionSidebar = buildVersionSidebar();
  document.body.appendChild(versionSidebar);
  document.addEventListener('opendesk:toggle-versions', () => {
    toggleVersionSidebar(versionSidebar);
  });

  const workflowPanel = buildWorkflowPanel();
  document.body.appendChild(workflowPanel);
  document.addEventListener('opendesk:toggle-workflows', () => {
    toggleWorkflowPanel(workflowPanel);
  });

  const refLibrary = buildReferenceLibrary(editor);
  document.body.appendChild(refLibrary.element);
  document.addEventListener('opendesk:toggle-reference-library', () => {
    refLibrary.toggle();
  });

  document.addEventListener('opendesk:insert-citation', () => {
    const citeBtn = document.querySelector('[data-action="insert-citation"]') as HTMLElement | null;
    const fallback = citeBtn ?? editorEl;
    openCitationPicker(editor, fallback);
  });

  document.addEventListener('opendesk:add-comment', () => {
    showCommentInput(editor, commentStore, documentId, user);
    toggleSidebar(commentSidebar, true);
    announce(t('a11y.commentAdded'));
  });


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

document.addEventListener('DOMContentLoaded', () => {
  initEditorPage();
  init();
});
