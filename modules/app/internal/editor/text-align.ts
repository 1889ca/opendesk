/** Contract: contracts/app/rules.md */
/**
 * TextAlign — custom TipTap extension for paragraph and heading alignment.
 * Implemented inline so no additional npm package is needed.
 * Supports: left (default), center, right, justify.
 */
import { Extension } from '@tiptap/core';

type Alignment = 'left' | 'center' | 'right' | 'justify';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: Alignment) => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
  }
}

export const TextAlign = Extension.create({
  name: 'textAlign',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.textAlign || null,
            renderHTML: (attributes: { textAlign?: string | null }) => {
              if (!attributes.textAlign || attributes.textAlign === 'left') return {};
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment: Alignment) =>
        ({ commands }) => {
          return (
            commands.updateAttributes('paragraph', { textAlign: alignment }) ||
            commands.updateAttributes('heading', { textAlign: alignment })
          );
        },
      unsetTextAlign:
        () =>
        ({ commands }) => {
          return (
            commands.resetAttributes('paragraph', 'textAlign') ||
            commands.resetAttributes('heading', 'textAlign')
          );
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-l': () => this.editor.commands.setTextAlign('left'),
      'Mod-Shift-e': () => this.editor.commands.setTextAlign('center'),
      'Mod-Shift-r': () => this.editor.commands.setTextAlign('right'),
      'Mod-Shift-j': () => this.editor.commands.setTextAlign('justify'),
    };
  },
});
