/** Contract: contracts/app/rules.md */
/**
 * FontSize — custom TipTap Mark extension for inline font size.
 * Renders as <span style="font-size: Npx">. Zero external dependencies.
 */
import { Mark } from '@tiptap/core';

export const FONT_SIZES = ['10', '11', '12', '14', '16', '18', '20', '24', '28', '36'];
export const DEFAULT_FONT_SIZE = '14';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Mark.create({
  name: 'fontSize',

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.style.fontSize;
          if (!raw) return null;
          // Strip 'px' and return numeric string
          return raw.replace('px', '').trim() || null;
        },
        renderHTML: (attributes: { fontSize?: string | null }) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}px` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[style*=font-size]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { fontSize: size });
        },
      unsetFontSize:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
