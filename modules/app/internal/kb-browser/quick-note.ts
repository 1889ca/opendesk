/** Contract: contracts/app/rules.md */

import { createEntryApi } from './kb-api.ts';

/**
 * Lightweight inline form for creating notes quickly.
 * Shown at the top of the KB browser when the "Notes" type filter is active.
 */
export function createQuickNote(onCreated: () => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'kb-quick-note';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'kb-quick-note__title';
  titleInput.placeholder = 'Note title';
  titleInput.required = true;

  const bodyArea = document.createElement('textarea');
  bodyArea.className = 'kb-quick-note__body';
  bodyArea.placeholder = 'Write your note (markdown supported)\u2026';
  bodyArea.rows = 3;

  const footer = document.createElement('div');
  footer.className = 'kb-quick-note__footer';

  const hint = document.createElement('span');
  hint.className = 'kb-quick-note__hint';
  hint.textContent = 'Markdown';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary btn-sm';
  saveBtn.textContent = 'Save Note';
  saveBtn.type = 'button';

  footer.appendChild(hint);
  footer.appendChild(saveBtn);

  wrapper.appendChild(titleInput);
  wrapper.appendChild(bodyArea);
  wrapper.appendChild(footer);

  saveBtn.addEventListener('click', () => handleSave(titleInput, bodyArea, saveBtn, onCreated));

  // Allow Ctrl/Cmd+Enter to save
  bodyArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave(titleInput, bodyArea, saveBtn, onCreated);
    }
  });

  return wrapper;
}

async function handleSave(
  titleInput: HTMLInputElement,
  bodyArea: HTMLTextAreaElement,
  saveBtn: HTMLButtonElement,
  onCreated: () => void,
): Promise<void> {
  const title = titleInput.value.trim();
  const body = bodyArea.value.trim();
  if (!title) { titleInput.focus(); return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving\u2026';

  try {
    await createEntryApi({
      entryType: 'note',
      title,
      metadata: { body, format: 'markdown', pinned: false },
      tags: [],
    });
    titleInput.value = '';
    bodyArea.value = '';
    onCreated();
  } catch (err) {
    console.error('Quick note save failed', err);
    alert(err instanceof Error ? err.message : 'Save failed');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Note';
  }
}
