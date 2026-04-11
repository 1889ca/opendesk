/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { batchRaf } from './lifecycle.ts';

type Alignment = 'left' | 'center' | 'right' | 'justify';

const ALIGNMENTS: { value: Alignment; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
];

export function buildAlignmentSelect(editor: Editor): { el: HTMLElement; cleanup: () => void } {
  const select = document.createElement('select');
  select.className = 'toolbar-select toolbar-select--align';
  select.setAttribute('aria-label', 'Text alignment');
  select.setAttribute('title', 'Text alignment');

  for (const a of ALIGNMENTS) {
    const opt = document.createElement('option');
    opt.value = a.value;
    opt.textContent = a.label;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    editor.chain().focus().setTextAlign(select.value as Alignment).run();
  });

  const updateValue = () => {
    for (const a of ALIGNMENTS) {
      if (editor.isActive({ textAlign: a.value })) { select.value = a.value; return; }
    }
    select.value = 'left';
  };

  const batched = batchRaf(updateValue);
  editor.on('selectionUpdate', batched.call);
  editor.on('transaction', batched.call);

  const cleanup = () => {
    batched.cancel();
    editor.off('selectionUpdate', batched.call);
    editor.off('transaction', batched.call);
  };

  return { el: select, cleanup };
}
