/** Contract: contracts/app/rules.md */
import { Node, mergeAttributes } from '@tiptap/core';
import type { NodeViewRendererProps } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      insertFootnote: (content: string) => ReturnType;
    };
  }
}

export const FootnoteNode = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-footnote-content') ?? '',
        renderHTML: (attrs) => ({ 'data-footnote-content': attrs.content as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'sup[data-footnote]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        'data-footnote': '',
        class: 'footnote-ref',
      }),
      '',
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }: NodeViewRendererProps) => {
      const sup = document.createElement('sup');
      sup.className = 'footnote-ref';
      const fnContent = node.attrs['content'] as string;
      sup.setAttribute('data-footnote-content', fnContent);
      sup.title = fnContent;

      function updateNumber(): void {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (pos === undefined) return;
        let count = 0;
        editor.state.doc.nodesBetween(0, pos, (n) => {
          if (n.type.name === 'footnote') count++;
          return true;
        });
        sup.textContent = String(count);
        sup.setAttribute('aria-label', `Footnote ${count}: ${fnContent}`);
        document.dispatchEvent(new CustomEvent('opendesk:footnotes-changed'));
      }

      sup.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('opendesk:scroll-to-footnote', {
          detail: { content: fnContent },
        }));
      });

      updateNumber();
      editor.on('update', updateNumber);

      return {
        dom: sup,
        destroy() { editor.off('update', updateNumber); },
      };
    };
  },

  addCommands() {
    return {
      insertFootnote:
        (content: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { content },
          }),
    };
  },
});
