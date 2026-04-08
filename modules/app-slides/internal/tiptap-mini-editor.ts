/** Contract: contracts/app-slides/rules.md */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import type { TextAlign } from './types.ts';

export type MiniEditorConfig = {
  content: string;
  fontSize: number;
  fontColor: string;
  textAlign: TextAlign;
  onUpdate: (html: string) => void;
};

export type MiniEditor = {
  editor: Editor;
  element: HTMLElement;
  destroy: () => void;
  activate: () => void;
  deactivate: () => void;
  isActive: () => boolean;
};

/** Create a lightweight TipTap editor for a slide text element */
export function createMiniEditor(config: MiniEditorConfig): MiniEditor {
  const container = document.createElement('div');
  container.className = 'slide-tiptap-container';
  let active = false;

  const editor = new Editor({
    element: container,
    extensions: [
      StarterKit.configure({
        // Disable features not needed in slides
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Underline,
    ],
    content: config.content || '',
    editable: false,
    onUpdate: ({ editor: ed }) => {
      config.onUpdate(ed.getHTML());
    },
  });

  applyTextStyles(container, config);

  return {
    editor,
    element: container,
    destroy: () => editor.destroy(),
    activate: () => {
      active = true;
      editor.setEditable(true);
      container.classList.add('slide-tiptap-active');
      editor.commands.focus('end');
    },
    deactivate: () => {
      active = false;
      editor.setEditable(false);
      container.classList.remove('slide-tiptap-active');
    },
    isActive: () => active,
  };
}

/** Apply element-level text styles to the container */
export function applyTextStyles(container: HTMLElement, config: Pick<MiniEditorConfig, 'fontSize' | 'fontColor' | 'textAlign'>): void {
  container.style.fontSize = `${config.fontSize}px`;
  container.style.color = config.fontColor;
  container.style.textAlign = config.textAlign;
}

/** Default text formatting values */
export const TEXT_DEFAULTS = {
  fontSize: 24,
  fontColor: '#000000',
  textAlign: 'left' as TextAlign,
};

/** Default title formatting values */
export const TITLE_DEFAULTS = {
  fontSize: 36,
  fontColor: '#000000',
  textAlign: 'center' as TextAlign,
};
