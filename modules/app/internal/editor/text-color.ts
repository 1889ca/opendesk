/** Contract: contracts/app/rules.md */
/**
 * TextColor — custom TipTap Mark extension for inline text color.
 * Renders as <span style="color: #xxx">. Zero external dependencies.
 */
import { Mark } from '@tiptap/core';

export const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Black', value: '#000000' },
  { label: 'Dark Gray', value: '#4a4a4a' },
  { label: 'Gray', value: '#9b9b9b' },
  { label: 'Red', value: '#e53935' },
  { label: 'Orange', value: '#fb8c00' },
  { label: 'Yellow', value: '#fdd835' },
  { label: 'Green', value: '#43a047' },
  { label: 'Teal', value: '#00897b' },
  { label: 'Blue', value: '#1e88e5' },
  { label: 'Purple', value: '#8e24aa' },
  { label: 'Pink', value: '#e91e63' },
];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
  }
}

export const TextColor = Mark.create({
  name: 'textColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.style.color;
          return raw || null;
        },
        renderHTML: (attributes: { color?: string | null }) => {
          if (!attributes.color) return {};
          return { style: `color: ${attributes.color}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[style*=color]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setTextColor:
        (color: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { color });
        },
      unsetTextColor:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
