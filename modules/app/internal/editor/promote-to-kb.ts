/** Contract: contracts/app/rules.md */

import type { Editor } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import { createEntryApi } from '@opendesk/app-kb';
import { announce } from '../shared/a11y-announcer.ts';
import { t } from '../i18n/index.ts';

/** Extract the selected content as an HTML string from the editor. */
function getSelectionHtml(editor: Editor): string {
  const { from, to } = editor.state.selection;
  if (from === to) return '';
  const slice = editor.state.doc.slice(from, to);
  const serializer = DOMSerializer.fromSchema(editor.schema);
  const container = document.createElement('div');
  container.appendChild(serializer.serializeFragment(slice.content));
  return container.innerHTML;
}

/** Extract the selected content as plain text. */
function getSelectionText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  if (from === to) return '';
  return editor.state.doc.textBetween(from, to, ' ');
}

/** Check whether the editor has a non-empty text selection. */
function hasSelection(editor: Editor): boolean {
  const { from, to } = editor.state.selection;
  return from !== to;
}

/** Show a brief toast notification that auto-dismisses. */
function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'promote-kb-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 2500);
}

/** Build the promote-to-KB modal DOM. Returns the overlay element. */
function buildModal(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'promote-kb-overlay';
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="promote-kb-dialog" role="dialog" aria-labelledby="promote-kb-heading">
      <h3 id="promote-kb-heading">${t('promoteKb.title')}</h3>
      <label class="promote-kb-label" for="promote-kb-title-input">${t('promoteKb.noteTitle')}</label>
      <input id="promote-kb-title-input" class="promote-kb-input" type="text" />
      <label class="promote-kb-label">${t('promoteKb.preview')}</label>
      <div class="promote-kb-preview" aria-readonly="true"></div>
      <label class="promote-kb-label" for="promote-kb-tags-input">${t('promoteKb.tags')}</label>
      <input id="promote-kb-tags-input" class="promote-kb-input" type="text"
        placeholder="${t('promoteKb.tagsPlaceholder')}" />
      <div class="promote-kb-actions">
        <button class="promote-kb-cancel">${t('promoteKb.cancel')}</button>
        <button class="promote-kb-save">${t('promoteKb.save')}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  return overlay;
}

/** Wire up event listeners for the modal and return control methods. */
function initModal(overlay: HTMLElement, editor: Editor) {
  const dialog = overlay.querySelector('.promote-kb-dialog') as HTMLElement;
  const titleInput = overlay.querySelector('#promote-kb-title-input') as HTMLInputElement;
  const tagsInput = overlay.querySelector('#promote-kb-tags-input') as HTMLInputElement;
  const preview = overlay.querySelector('.promote-kb-preview') as HTMLElement;
  const saveBtn = overlay.querySelector('.promote-kb-save') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('.promote-kb-cancel') as HTMLButtonElement;

  let htmlContent = '';

  function close(): void {
    overlay.hidden = true;
    htmlContent = '';
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  cancelBtn.addEventListener('click', close);

  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = t('promoteKb.saving');

    const rawTags = tagsInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    const tags = ['source:doc', ...rawTags];

    try {
      await createEntryApi({
        entryType: 'note',
        title,
        metadata: { body: htmlContent, format: 'html', pinned: false },
        tags,
      });
      close();
      showToast(t('promoteKb.success'));
      announce(t('promoteKb.success'));
    } catch (err) {
      showToast(t('promoteKb.error'));
      console.error('Promote to KB failed:', err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = t('promoteKb.save');
    }
  });

  return {
    open() {
      const plainText = getSelectionText(editor);
      htmlContent = getSelectionHtml(editor);
      titleInput.value = plainText.slice(0, 60);
      preview.innerHTML = htmlContent;
      tagsInput.value = '';
      overlay.hidden = false;
      titleInput.focus();
    },
    close,
  };
}

/**
 * Set up the promote-to-KB feature: modal, event listener, and
 * selection-based button enable/disable.
 */
export function setupPromoteToKB(editor: Editor): void {
  const overlay = buildModal();
  const modal = initModal(overlay, editor);

  document.addEventListener('opendesk:promote-to-kb', () => {
    if (hasSelection(editor)) modal.open();
  });

  const updateBtn = () => {
    const btn = document.querySelector(
      '[data-i18n-key="toolbar.saveToKb"]',
    ) as HTMLButtonElement | null;
    if (btn) btn.disabled = !hasSelection(editor);
  };
  editor.on('selectionUpdate', updateBtn);
  editor.on('transaction', updateBtn);
}
