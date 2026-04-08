/** Contract: contracts/app/slides-interaction.md */

import * as Y from 'yjs';

export interface SpeakerNotesPanel {
  element: HTMLElement;
  update: (slideIndex: number) => void;
  destroy: () => void;
}

interface SpeakerNotesContext {
  ydoc: Y.Doc;
  yslides: Y.Array<Y.Map<unknown>>;
}

/** Create the speaker notes panel with a collapsible textarea. */
export function createSpeakerNotes(ctx: SpeakerNotesContext): SpeakerNotesPanel {
  const { ydoc, yslides } = ctx;
  let currentSlideIndex = 0;
  let isCollapsed = false;

  const panel = document.createElement('div');
  panel.className = 'speaker-notes-panel';

  const header = document.createElement('div');
  header.className = 'speaker-notes__header';

  const title = document.createElement('span');
  title.className = 'speaker-notes__title';
  title.textContent = 'Speaker Notes';

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'speaker-notes__toggle';
  toggleBtn.textContent = '\u25BC';
  toggleBtn.setAttribute('aria-label', 'Toggle speaker notes');
  toggleBtn.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    panel.classList.toggle('collapsed', isCollapsed);
    toggleBtn.textContent = isCollapsed ? '\u25B2' : '\u25BC';
  });

  header.append(title, toggleBtn);

  const textarea = document.createElement('textarea');
  textarea.className = 'speaker-notes__textarea';
  textarea.placeholder = 'Add speaker notes for this slide\u2026';
  textarea.rows = 4;

  // Debounced save to Yjs
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  function saveNotes() {
    const slide = yslides.get(currentSlideIndex);
    if (!slide) return;
    ydoc.transact(() => {
      slide.set('notes', textarea.value);
    });
  }

  textarea.addEventListener('input', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveNotes, 300);
  });

  // Immediate save on blur
  textarea.addEventListener('blur', () => {
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
    saveNotes();
  });

  panel.append(header, textarea);

  function update(slideIndex: number) {
    currentSlideIndex = slideIndex;
    const slide = yslides.get(slideIndex);
    const notes = slide ? String(slide.get('notes') ?? '') : '';
    textarea.value = notes;
  }

  // Sync incoming Yjs changes
  function handleRemoteChange() {
    const slide = yslides.get(currentSlideIndex);
    if (!slide) return;
    const notes = String(slide.get('notes') ?? '');
    // Don't overwrite if user is actively typing
    if (document.activeElement !== textarea) {
      textarea.value = notes;
    }
  }

  yslides.observeDeep(handleRemoteChange);

  return {
    element: panel,
    update,
    destroy() {
      if (saveTimeout) clearTimeout(saveTimeout);
      yslides.unobserveDeep(handleRemoteChange);
      panel.remove();
    },
  };
}

/** Get the notes text for a specific slide. */
export function getSlideNotes(yslides: Y.Array<Y.Map<unknown>>, index: number): string {
  const slide = yslides.get(index);
  return slide ? String(slide.get('notes') ?? '') : '';
}
