/** Contract: contracts/app/rules.md */
/**
 * FontFamily — custom TipTap Mark extension for inline font family.
 * Renders as <span style="font-family: ...">. Zero external dependencies.
 */
import { Mark } from '@tiptap/core';

export const FONT_FAMILIES = [
  { label: 'Body Font', value: '' },
  // Sans-serif
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Roboto', value: 'Roboto, Arial, sans-serif' },
  { label: 'Open Sans', value: '"Open Sans", Arial, sans-serif' },
  { label: 'Lato', value: 'Lato, Arial, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, Arial, sans-serif' },
  { label: 'Nunito', value: 'Nunito, Arial, sans-serif' },
  // Serif
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Merriweather', value: 'Merriweather, Georgia, serif' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
  // Monospace
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Fira Code', value: '"Fira Code", "Courier New", monospace' },
  { label: 'Source Code Pro', value: '"Source Code Pro", "Courier New", monospace' },
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
