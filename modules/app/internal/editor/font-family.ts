/** Contract: contracts/app/rules.md */
/**
 * FontFamily — custom TipTap Mark extension for inline font family.
 * Renders as <span style="font-family: ...">. Zero external dependencies.
 */
import { Mark } from '@tiptap/core';

export const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
];

export const DEFAULT_FONT_FAMILY = '';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (family: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
  }
}

export const FontFamily = Mark.create({
  name: 'fontFamily',

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          return element.style.fontFamily || null;
        },
        renderHTML: (attributes: { fontFamily?: string | null }) => {
          if (!attributes.fontFamily) return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[style*=font-family]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setFontFamily:
        (family: string) =>
        ({ commands }) => {
          if (!family) return commands.unsetMark(this.name);
          return commands.setMark(this.name, { fontFamily: family });
        },
      unsetFontFamily:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
