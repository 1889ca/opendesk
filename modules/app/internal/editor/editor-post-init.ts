/** Contract: contracts/app/rules.md */
/**
 * Post-initialization steps for the editor: template application,
 * spell check, focus mode, and header/footer setup.
 * Extracted from editor.ts to keep files under 200 lines.
 */
import type { Editor } from '@tiptap/core';
import { apiFetch } from '../shared/api-client.ts';
import { trackRecentDoc } from '../shared/workspace-sidebar.ts';
import { initSpellCheckCycle } from './spell-check.ts';
import { initFocusModeButton } from './focus-mode.ts';
import { insertHeaderFooter, insertPageNumber, activateZone, setupHeaderFooterClicks } from './header-footer.ts';
import { initPageSetup, showPageSetupDialog } from './page-setup.ts';

export function applyPendingTemplate(editor: Editor, documentId: string): void {
  const pendingHtml = sessionStorage.getItem(`opendesk-template-${documentId}`);
  if (pendingHtml) {
    sessionStorage.removeItem(`opendesk-template-${documentId}`);
    setTimeout(() => {
      if (editor.isEmpty) {
        editor.commands.setContent(pendingHtml);
      }
    }, 500);
  }
}

export function setupPageControls(editor: Editor, documentId: string): void {
  initPageSetup();

  document.getElementById('page-setup-btn')?.addEventListener('click', showPageSetupDialog);

  const { headerZone, footerZone } = insertHeaderFooter(documentId);

  setupHeaderFooterClicks(headerZone, footerZone);

  document.getElementById('insert-page-number')?.addEventListener('click', () => {
    activateZone(footerZone);
    insertPageNumber(footerZone);
  });
}

export function trackDocMetadata(documentId: string): void {
  apiFetch(`/api/documents/${encodeURIComponent(documentId)}`)
    .then((res: Response) => (res.ok ? res.json() : null))
    .then((doc: { title?: string; document_type?: string } | null) => {
      if (doc) trackRecentDoc({ id: documentId, title: doc.title || 'Untitled', document_type: doc.document_type });
    })
    .catch(() => {});
}

export function initEditorPostInit(editor: Editor, editorEl: HTMLElement, documentId: string): void {
  applyPendingTemplate(editor, documentId);
  trackDocMetadata(documentId);
  initSpellCheckCycle(editorEl);
  initFocusModeButton();
  setupPageControls(editor, documentId);
}
