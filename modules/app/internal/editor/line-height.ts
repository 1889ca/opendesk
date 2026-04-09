/** Contract: contracts/app/rules.md */
/**
 * LineHeight — custom TipTap Extension that adds a lineHeight attribute
 * to paragraph and heading nodes. Zero external dependencies.
 */
import { Extension } from '@tiptap/core';

export const LINE_HEIGHTS = ['1', '1.15', '1.5', '2', '2.5', '3'];
export const DEFAULT_LINE_HEIGHT = '1.5';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (value: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const LineHeight = Extension.create({
  name: 'lineHeight',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: { lineHeight?: string | null }) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        ({ commands }) => {
          return (
            commands.updateAttributes('paragraph', { lineHeight: value }) ||
            commands.updateAttributes('heading', { lineHeight: value })
          );
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          return (
            commands.resetAttributes('paragraph', 'lineHeight') ||
            commands.resetAttributes('heading', 'lineHeight')
          );
        },
    };
  },
});
