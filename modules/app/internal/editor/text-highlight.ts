/** Contract: contracts/app/rules.md */
/**
 * TextHighlight — custom TipTap Mark extension for inline background highlight color.
 * Renders as <span style="background-color: #xxx">. Zero external dependencies.
 */
import { Mark } from '@tiptap/core';

export const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Yellow', value: '#fff176' },
  { label: 'Green', value: '#c8e6c9' },
  { label: 'Blue', value: '#bbdefb' },
  { label: 'Pink', value: '#f8bbd0' },
  { label: 'Orange', value: '#ffe0b2' },
  { label: 'Purple', value: '#e1bee7' },
];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textHighlight: {
      setTextHighlight: (color: string) => ReturnType;
      unsetTextHighlight: () => ReturnType;
    };
  }
}

export const TextHighlight = Mark.create({
  name: 'textHighlight',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.style.backgroundColor;
          return raw || null;
        },
        renderHTML: (attributes: { color?: string | null }) => {
          if (!attributes.color) return {};
          return { style: `background-color: ${attributes.color}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[style*=background-color]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setTextHighlight:
        (color: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { color });
        },
      unsetTextHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
