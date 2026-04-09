/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import type { Transaction } from 'prosemirror-state';

interface CellColor {
  label: string;
  color: string;
  style: string;
}

export const CELL_COLORS: CellColor[] = [
  {
    label: 'Clear',
    color: '',
    style:
      'background: repeating-linear-gradient(45deg, #ccc 0, #ccc 2px, white 0, white 50%) center/8px 8px',
  },
  { label: 'Yellow', color: '#fef9c3', style: 'background: #fef9c3' },
  { label: 'Green', color: '#dcfce7', style: 'background: #dcfce7' },
  { label: 'Blue', color: '#dbeafe', style: 'background: #dbeafe' },
  { label: 'Red', color: '#fee2e2', style: 'background: #fee2e2' },
  { label: 'Purple', color: '#f3e8ff', style: 'background: #f3e8ff' },
  { label: 'Gray', color: '#f3f4f6', style: 'background: #f3f4f6' },
];

type CellAlignment = 'left' | 'center' | 'right';

interface AlignButton {
  label: string;
  align: CellAlignment;
  icon: string;
}

export const CELL_ALIGN_BUTTONS: AlignButton[] = [
  { label: 'Align left', align: 'left', icon: '⬅' },
  { label: 'Align center', align: 'center', icon: '↔' },
  { label: 'Align right', align: 'right', icon: '➡' },
];

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

/** Build the cell formatting section DOM and append it to the container. */
export function buildCellFormatSection(
  container: HTMLElement,
  editor: Editor,
): void {
  // Separator
  const sep1 = document.createElement('div');
  sep1.className = 'table-toolbar-cell-section';

  const label = document.createElement('span');
  label.className = 'table-toolbar-label';
  label.textContent = 'Cell:';
  sep1.appendChild(label);

  // Color swatches
  for (const { label: colorLabel, color, style } of CELL_COLORS) {
    const btn = document.createElement('button');
    btn.className = 'table-toolbar-color-swatch';
    btn.title = colorLabel;
    btn.setAttribute('aria-label', `Cell background: ${colorLabel}`);
    btn.setAttribute('style', style);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setCellBackground(editor, color);
    });
    sep1.appendChild(btn);
  }

  container.appendChild(sep1);

  // Alignment section
  const sep2 = document.createElement('div');
  sep2.className = 'table-toolbar-cell-section';

  const alignLabel = document.createElement('span');
  alignLabel.className = 'table-toolbar-label';
  alignLabel.textContent = 'Align:';
  sep2.appendChild(alignLabel);

  for (const { label: alignLabel2, align, icon } of CELL_ALIGN_BUTTONS) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn table-toolbar-btn';
    btn.title = alignLabel2;
    btn.setAttribute('aria-label', alignLabel2);
    btn.textContent = icon;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setCellTextAlign(editor, align);
    });
    sep2.appendChild(btn);
  }

  container.appendChild(sep2);
}
