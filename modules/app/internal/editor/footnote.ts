/** Contract: contracts/app/rules.md */
import { Node, mergeAttributes, type NodeViewRendererProps } from '@tiptap/core';
import { batchRaf } from './lifecycle.ts';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      insertFootnote: (content: string) => ReturnType;
    };
  }
}

/**
 * Shared renumbering logic for all footnote node views.
 * Instead of N handlers (one per footnote), a single batched handler
 * walks the doc once and updates all registered DOM elements.
 */
const footnoteViews = new Set<{ sup: HTMLElement; getPos: () => number | undefined; content: string }>();
let batchedRenumber: { call: () => void; cancel: () => void } | null = null;
let currentEditor: import('@tiptap/core').Editor | null = null;

function renumberAll(): void {
  if (!currentEditor) return;
  let count = 0;
  const posMap = new Map<number, number>();
  currentEditor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'footnote') {
      count++;
      posMap.set(pos, count);
    }
    return true;
  });

  for (const view of footnoteViews) {
    const pos = view.getPos();
    if (pos === undefined) continue;
    const num = posMap.get(pos);
    if (num !== undefined) {
      view.sup.textContent = String(num);
      view.sup.setAttribute('aria-label', `Footnote ${num}: ${view.content}`);
    }
  }

  document.dispatchEvent(new CustomEvent('opendesk:footnotes-changed'));
}

function ensureBatchHandler(editor: import('@tiptap/core').Editor): void {
  if (batchedRenumber) return;
  currentEditor = editor;
  batchedRenumber = batchRaf(renumberAll);
  editor.on('update', batchedRenumber.call);
  editor.on('destroy', () => {
    batchedRenumber?.cancel();
    batchedRenumber = null;
    currentEditor = null;
    footnoteViews.clear();
  });
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

      const view = {
        sup,
        getPos: getPos as () => number | undefined,
        content: fnContent,
      };

      ensureBatchHandler(editor);
      footnoteViews.add(view);

      // Initial numbering
      batchedRenumber!.call();

      sup.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('opendesk:scroll-to-footnote', {
          detail: { content: fnContent },
        }));
      });

      return {
        dom: sup,
        destroy() { footnoteViews.delete(view); },
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
