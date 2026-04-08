/** Contract: contracts/app/slides-element-types.md */

import type { MiniEditor } from './tiptap-mini-editor.ts';
import { createFormatToolbar, type FormatToolbar } from './text-format-toolbar.ts';
import { applyTextStyles } from './tiptap-mini-editor.ts';
import type { TextAlign } from './types.ts';
import type { TextElementDom } from './render-text.ts';

export type TextEditState = {
  elementId: string;
  miniEditor: MiniEditor;
  toolbar: FormatToolbar;
};

export type TextEditController = {
  enterEditMode: (elementId: string, dom: HTMLElement) => void;
  exitEditMode: () => void;
  isEditing: () => boolean;
  getEditingId: () => string | null;
  destroy: () => void;
};

type StyleUpdateFn = (elementId: string, field: string, value: unknown) => void;

/** Create a controller that manages text editing mode for slide elements */
export function createTextEditController(
  viewport: HTMLElement,
  onStyleUpdate: StyleUpdateFn,
): TextEditController {
  let state: TextEditState | null = null;

  function enterEditMode(elementId: string, dom: HTMLElement) {
    // Exit any current edit first
    exitEditMode();

    const typedDom = dom as TextElementDom;
    const miniEditor = typedDom.__miniEditor;
    if (!miniEditor) return;

    miniEditor.activate();
    dom.classList.add('slide-element--editing');

    const fontSize = Number(dom.dataset.fontSize) || 24;
    const fontColor = dom.dataset.fontColor || '#000000';
    const textAlign = (dom.dataset.textAlign || 'left') as TextAlign;

    const toolbar = createFormatToolbar(miniEditor.editor, {
      fontSize,
      fontColor,
      textAlign,
      onFontSizeChange: (size) => {
        onStyleUpdate(elementId, 'fontSize', size);
        applyTextStyles(miniEditor.element, { fontSize: size, fontColor, textAlign });
        dom.dataset.fontSize = String(size);
      },
      onFontColorChange: (color) => {
        onStyleUpdate(elementId, 'fontColor', color);
        applyTextStyles(miniEditor.element, { fontSize, fontColor: color, textAlign });
        dom.dataset.fontColor = color;
      },
      onTextAlignChange: (align) => {
        onStyleUpdate(elementId, 'textAlign', align);
        applyTextStyles(miniEditor.element, { fontSize, fontColor, textAlign: align });
        dom.dataset.textAlign = align;
      },
    });

    viewport.parentElement?.insertBefore(toolbar.element, viewport);

    // Update toolbar state when editor selection changes
    miniEditor.editor.on('selectionUpdate', () => {
      toolbar.update(miniEditor.editor);
    });
    miniEditor.editor.on('transaction', () => {
      toolbar.update(miniEditor.editor);
    });

    state = { elementId, miniEditor, toolbar };
  }

  function exitEditMode() {
    if (!state) return;
    state.miniEditor.deactivate();
    state.toolbar.destroy();

    // Remove editing class from DOM
    const editingEl = viewport.querySelector(`[data-element-id="${state.elementId}"]`);
    if (editingEl) editingEl.classList.remove('slide-element--editing');

    state = null;
  }

  return {
    enterEditMode,
    exitEditMode,
    isEditing: () => state !== null,
    getEditingId: () => state?.elementId ?? null,
    destroy: () => exitEditMode(),
  };
}
