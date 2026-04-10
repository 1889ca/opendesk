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
import { initPageSetup, showPageSetupDialog } from './page-setup.ts';
import { insertHeaderFooter, insertPageNumber } from './header-footer.ts';
import {
  registerServiceWorker,
  buildOfflineIndicator,
  buildUpdateBanner,
  initConnectivityListeners,
} from '../offline/index.ts';
import { mountAppToolbar } from '../shared/app-toolbar.ts';
import { initEditorCollab } from './editor-collab.ts';
import { initAiAssist } from './ai-assist.ts';

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
    url: wsUrl, name: documentId, document: ydoc,
    // Use the real auth token — 'dev' sentinel is rejected by the collab server (#340)
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

  // Allow native context menu — prevent any TipTap extension or parent listener
  // from suppressing right-click (issue #255)
  editorEl.addEventListener('contextmenu', (e) => {
    e.stopPropagation();
  }, { capture: true });

  setupCodeBlockUI(editor);
  initEntityMentionClicks(editorEl);
  buildFormattingToolbar(editor);
  buildBubbleMenu(editor);
  initAiAssist(editor);
  buildTableToolbar(editor);
  buildSearchPanel(editor);
  buildLanguageSwitcher();
  buildThemeToggle();
  buildNotificationBell();

  // Save indicator — "Saving…" / "Saved" next to doc title
  const toolbarLeft = document.querySelector('.toolbar-left');
  if (toolbarLeft) toolbarLeft.appendChild(buildSaveIndicator(editor));

  apiFetch(`/api/documents/${encodeURIComponent(documentId)}`)
    .then((res: Response) => (res.ok ? res.json() : null))
    .then((doc: { title?: string; document_type?: string } | null) => {
      if (doc) trackRecentDoc({ id: documentId, title: doc.title || 'Untitled', document_type: doc.document_type });
    })
    .catch(() => {});
  setupImageHandlers(editor, editorEl);
  bindShortcutDialogKey();

  initEditorCollab({ editor, editorEl, provider, statusEl, usersEl, user });

  initEditorPanels({ editor, editorEl, commentStore, documentId, user });
  initRuler();
  initZoomControl();
  initPageSetup();

  // Wire up the Page Setup button in the toolbar
  document.getElementById('page-setup-btn')?.addEventListener('click', showPageSetupDialog);

  // Header / footer zones — inserted above and below the editor paper
  const { footerZone } = insertHeaderFooter(documentId);

  // Wire up "Insert Page Number" button
  document.getElementById('insert-page-number')?.addEventListener('click', () => {
    insertPageNumber(footerZone);
  });

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

  // Spell check — cycle through misspelled words on 'opendesk:spellcheck-cycle'
  // Uses the browser's built-in spellcheck (spellcheck="true" on the editor element).
  // Finds text nodes with browser-marked spelling errors and scrolls/focuses each one.
  let _spellPos = 0;
  document.addEventListener('opendesk:spellcheck-cycle', () => {
    const editorContent = editorEl.querySelector('.editor-content') ?? editorEl;
    // Collect all text nodes in document order
    const walker = document.createTreeWalker(editorContent, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) textNodes.push(n as Text);
    if (textNodes.length === 0) return;

    // Wrap each text node in a Range, query spelling errors via execCommand workaround.
    // The most reliable cross-browser approach is to move selection to the next word
    // that the browser marks as misspelled, using Selection API + execCommand.
    // We iterate words: move caret, then check if the browser auto-selects a red-underline word.
    const sel = window.getSelection();
    if (!sel) return;

    // Find words in all text nodes starting from _spellPos offset
    const words: { node: Text; start: number; end: number }[] = [];
    for (const node of textNodes) {
      const text = node.textContent ?? '';
      const regex = /\b\w+\b/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        words.push({ node, start: m.index, end: m.index + m[0].length });
      }
    }
    if (words.length === 0) return;

    const idx = _spellPos % words.length;
    _spellPos = idx + 1;
    const { node, start, end } = words[idx];

    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    sel.removeAllRanges();
    sel.addRange(range);
    node.parentElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    editorEl.focus();
  });

  Object.assign(window, { editor, provider, ydoc, commentStore });
}

document.addEventListener('DOMContentLoaded', () => {
  mountAppToolbar({ usersHidden: true });
  initEditorPage();
  init();
});
