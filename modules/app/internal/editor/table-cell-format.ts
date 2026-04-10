/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import type { Transaction } from 'prosemirror-state';

export interface CellColor {
  label: string;
  color: string;
  style: string;
}

export type CellAlignment = 'left' | 'center' | 'right';

export interface AlignButton {
  label: string;
  align: CellAlignment;
  icon: string;
}

/** Apply background-color to all selected table cells via a ProseMirror transaction. */
export function setCellBackground(editor: Editor, color: string): void {
  const { state, view } = editor;
  const { selection } = state;
  let tr: Transaction = state.tr;
  let changed = false;

  const applyToNode = (
    node: ReturnType<typeof state.doc.nodeAt> & object,
    pos: number,
  ) => {
    if (
      !node ||
      (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader')
    ) {
      return;
    }
    const currentStyle: string = (node.attrs.style as string) ?? '';
    const cleared = currentStyle
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('background-color'))
      .join('; ');
    const newStyle = color
      ? [cleared, `background-color: ${color}`].filter(Boolean).join('; ')
      : cleared;
    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      style: newStyle || null,
    });
    changed = true;
  };

  // Handle CellSelection (multiple cells selected)
  if ('ranges' in selection && 'isRowSelection' in selection) {
    (
      selection as unknown as {
        ranges: Array<{ $from: { pos: number }; $to: { pos: number } }>;
      }
    ).ranges.forEach(({ $from, $to }) => {
      state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
        applyToNode(node as Parameters<typeof applyToNode>[0], pos);
      });
    });
  } else {
    // Single cursor — find the containing cell
    const { $from } = selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (
        node.type.name === 'tableCell' ||
        node.type.name === 'tableHeader'
      ) {
        applyToNode(
          node as Parameters<typeof applyToNode>[0],
          $from.before(depth),
        );
        break;
      }
    }
  }

  if (changed) view.dispatch(tr);
}

/** Apply text-align to content paragraphs inside selected table cells. */
export function setCellTextAlign(
  editor: Editor,
  align: CellAlignment,
): void {
  const { state, view } = editor;
  const { selection } = state;
  let tr: Transaction = state.tr;
  let changed = false;

  const applyAlignment = (cellFrom: number, cellTo: number) => {
    state.doc.nodesBetween(cellFrom, cellTo, (node, pos) => {
      if (node.type.name === 'paragraph' || node.type.name === 'heading') {
        const currentStyle: string = (node.attrs.style as string) ?? '';
        const cleared = currentStyle
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith('text-align'))
          .join('; ');
        const newStyle =
          align !== 'left'
            ? [cleared, `text-align: ${align}`].filter(Boolean).join('; ')
            : cleared;
        tr = tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          style: newStyle || null,
        });
        changed = true;
      }
    });
  };

  if ('ranges' in selection && 'isRowSelection' in selection) {
    (
      selection as unknown as {
        ranges: Array<{ $from: { pos: number }; $to: { pos: number } }>;
      }
    ).ranges.forEach(({ $from, $to }) => {
      state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
        if (
          node.type.name === 'tableCell' ||
          node.type.name === 'tableHeader'
        ) {
          applyAlignment(pos + 1, pos + node.nodeSize - 1);
        }
      });
    });
  } else {
    const { $from } = selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (
        node.type.name === 'tableCell' ||
        node.type.name === 'tableHeader'
      ) {
        const cellPos = $from.before(depth);
        applyAlignment(cellPos + 1, cellPos + node.nodeSize - 1);
        break;
      }
    }
  }

  if (changed) view.dispatch(tr);
}
