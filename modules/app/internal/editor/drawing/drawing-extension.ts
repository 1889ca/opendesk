/** Contract: contracts/app/rules.md */
/**
 * TipTap Node extension for inline drawings.
 * Stores an SVG data URI as the node's `src` attribute and renders as <img>.
 * Double-clicking the image reopens the drawing canvas for editing.
 */

import { Node, mergeAttributes, type NodeViewRendererProps } from '@tiptap/core';
import { openDrawingDialog } from './drawing-dialog.ts';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawing: {
      insertDrawing: (svg: string) => ReturnType;
    };
  }
}

function svgToDataUri(svg: string): string {
  // Encode as a data URI so it works as <img src>
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}

function dataUriToSvg(src: string): string | undefined {
  if (!src.startsWith('data:image/svg+xml,')) return undefined;
  return decodeURIComponent(src.slice('data:image/svg+xml,'.length));
}

export const DrawingExtension = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: (el) => el.getAttribute('src') ?? '',
        renderHTML: (attrs) => ({ src: attrs.src as string }),
      },
      width: {
        default: '100%',
        parseHTML: (el) => el.getAttribute('data-drawing-width') ?? '100%',
        renderHTML: (attrs) => ({ 'data-drawing-width': attrs.width as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-drawing]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        'data-drawing': '',
        class: 'drawing-node-img',
        alt: 'Inline drawing',
      }),
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }: NodeViewRendererProps) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'drawing-node-wrapper';
      wrapper.contentEditable = 'false';

      const img = document.createElement('img');
      img.className = 'drawing-node-img';
      img.alt = 'Inline drawing (double-click to edit)';
      img.title = 'Double-click to edit drawing';
      img.src = node.attrs['src'] as string;
      img.setAttribute('data-drawing', '');

      wrapper.appendChild(img);

      img.addEventListener('dblclick', () => {
        const existingSvg = dataUriToSvg(node.attrs['src'] as string);
        openDrawingDialog(existingSvg).then((svgResult) => {
          if (!svgResult) return;
          if (typeof getPos !== 'function') return;
          const pos = getPos();
          if (pos === undefined) return;
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              tr.setNodeAttribute(pos, 'src', svgToDataUri(svgResult));
              return true;
            })
            .run();
        });
      });

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type.name !== 'drawing') return false;
          img.src = updatedNode.attrs['src'] as string;
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      insertDrawing:
        (svg: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { src: svgToDataUri(svg) },
          }),
    };
  },
});
