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
import { setSuggestUser, createSuggestModePlugin, setupSuggestionClickHandler } from './suggestions/index.ts';
import { bindShortcutDialogKey } from '../shared/shortcut-dialog.ts';
import { initTouchSupport } from '../shared/touch-support.ts';
import { buildThemeToggle } from '../shared/theme-toggle.ts';
import { buildNotificationBell } from '../shared/notification-bell.ts';
import { apiFetch, getAuthToken } from '../shared/api-client.ts';
import { setupCodeBlockUI } from './code-block-ui.ts';
import { buildEditorExtensions } from './editor-extensions.ts';
import { initEntityMentionClicks } from './entity-mentions/index.ts';
import { getUserIdentity, getDocumentId } from '../shared/identity.ts';
import { ensureNameConfirmed } from '../shared/name-setup.ts';
import { initEditorPage } from './editor-page.ts';
import { initEditorPanels } from './editor-panels.ts';
import { initRuler } from './editor-ruler.ts';
import { initZoomControl } from './zoom-control.ts';
import { buildSaveIndicator } from './save-indicator.ts';
import { registerServiceWorker, buildOfflineIndicator, buildUpdateBanner, initConnectivityListeners, attachYjsPersistence } from '../offline/index.ts';
import { mountAppToolbar } from '../shared/app-toolbar.ts';
import { initEditorCollab } from './editor-collab.ts';
import { initAiAssist } from './ai-assist.ts';
import { buildMenuBar } from './menu-bar.ts';
import { mountEditorRails } from './editor-rails.ts';
import { initEditorPostInit } from './editor-post-init.ts';

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
  const persistence = await attachYjsPersistence(ydoc, documentId);
  const commentStore = new CommentStore(ydoc);
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/collab`;
  const toolbarRight = document.querySelector('.toolbar-right');
  if (toolbarRight) {
    const offlineEl = buildOfflineIndicator();
    toolbarRight.insertBefore(offlineEl, toolbarRight.firstChild);
  }
  document.body.insertBefore(buildUpdateBanner(), document.body.firstChild);

  if (statusEl) { statusEl.textContent = t('status.connecting'); statusEl.className = 'status connecting'; }

  const provider = new HocuspocusProvider({
    url: wsUrl, name: documentId, document: ydoc,
    token: getAuthToken(),
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

  // Focus editor at end when clicking empty page space below content (issue #437)
  const editorWrapper = document.querySelector<HTMLElement>('.editor-wrapper');
  if (editorWrapper) {
    editorWrapper.addEventListener('click', (e) => {
      const target = e.target as Node;
      const canvasTitleWrap = document.querySelector('.editor-canvas-title-wrap');
      if (!editorEl.contains(target) && !(canvasTitleWrap?.contains(target))) {
        editor.commands.focus('end');
      }
    });
  }

  // Allow native context menu (issue #255)
  editorEl.addEventListener('contextmenu', (e) => {
    e.stopPropagation();
  }, { capture: true });

  setupCodeBlockUI(editor);
  initEntityMentionClicks(editorEl);

  const menuBar = buildMenuBar(editor);
  const menuBarSlot = document.getElementById('menu-bar');
  if (menuBarSlot) {
    menuBarSlot.replaceWith(menuBar.el);
  }

  mountEditorRails({ editor, commentStore, documentId, user });

  buildFormattingToolbar(editor);
  buildBubbleMenu(editor);
  initAiAssist(editor);
  buildTableToolbar(editor);
  buildSearchPanel(editor);
  buildLanguageSwitcher();
  buildThemeToggle();
  buildNotificationBell();

  const toolbarLeft = document.querySelector('.toolbar-left');
  if (toolbarLeft) toolbarLeft.appendChild(buildSaveIndicator(editor));

  setupImageHandlers(editor, editorEl);
  bindShortcutDialogKey();

  initEditorCollab({ editor, editorEl, provider, statusEl, usersEl, user });
  initEditorPanels({ editor, editorEl, commentStore, documentId, user });
  initRuler();
  initZoomControl();

  initEditorPostInit(editor, editorEl, documentId);

  console.log('[boot] init-complete');
  Object.assign(window, { editor, provider, ydoc, commentStore, persistence });
}

document.addEventListener('DOMContentLoaded', () => {
  mountAppToolbar({ usersHidden: true });
  initEditorPage();
  init();
});
