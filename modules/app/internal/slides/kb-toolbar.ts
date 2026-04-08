/** Contract: contracts/app/rules.md */

/**
 * KB toolbar buttons for the slides editor.
 * Provides "Insert from KB" dropdown with citation, entity, and dataset options.
 */

import * as Y from 'yjs';
import { openKbPicker, type KbPickerMode, type KbInsertResult } from './kb-picker.ts';
import { insertKbElement } from './kb-elements.ts';

export interface KbToolbarContext {
  ydoc: Y.Doc;
  yslides: Y.Array<Y.Map<unknown>>;
  getActiveSlideIndex: () => number;
  onInsert: () => void;
}

/** Build the "Insert from KB" toolbar button with dropdown */
export function buildKbToolbar(ctx: KbToolbarContext): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'slides-kb-menu';

  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.textContent = 'Insert from KB';
  btn.title = 'Insert citation, entity, or dataset from Knowledge Base';

  const dropdown = document.createElement('div');
  dropdown.className = 'slides-kb-dropdown';
  dropdown.hidden = true;

  const options: Array<{ label: string; mode: KbPickerMode }> = [
    { label: 'Citation', mode: 'citation' },
    { label: 'Entity Mention', mode: 'entity' },
    { label: 'Dataset Chart', mode: 'dataset' },
  ];

  for (const { label, mode } of options) {
    const option = document.createElement('button');
    option.className = 'slides-kb-option';
    option.textContent = label;
    option.addEventListener('click', () => {
      dropdown.hidden = true;
      openKbPicker(btn, mode, (result: KbInsertResult) => {
        insertKbElement(
          ctx.ydoc,
          ctx.yslides,
          ctx.getActiveSlideIndex(),
          result,
        );
        ctx.onInsert();
      });
    });
    dropdown.appendChild(option);
  }

  btn.addEventListener('click', () => {
    dropdown.hidden = !dropdown.hidden;
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      dropdown.hidden = true;
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);
  return wrapper;
}
