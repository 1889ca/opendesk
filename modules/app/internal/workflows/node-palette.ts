/** Contract: contracts/workflow/rules.md */
import type { PaletteItem, NodeType } from './types.ts';

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'trigger',
    label: 'Trigger',
    defaultConfig: { triggerType: 'document.updated' },
  },
  {
    type: 'condition',
    label: 'Condition',
    defaultConfig: { field: 'document.title', operator: 'contains', value: '' },
  },
  {
    type: 'action',
    label: 'Webhook',
    defaultConfig: { actionType: 'webhook', actionConfig: { url: '' } },
  },
  {
    type: 'action',
    label: 'Notify',
    defaultConfig: { actionType: 'notify', actionConfig: { message: '' } },
  },
  {
    type: 'action',
    label: 'Export',
    defaultConfig: { actionType: 'export', actionConfig: { format: 'pdf' } },
  },
  {
    type: 'action',
    label: 'Set Metadata',
    defaultConfig: { actionType: 'set_metadata', actionConfig: { key: '', value: '' } },
  },
  {
    type: 'action',
    label: 'Move to Folder',
    defaultConfig: { actionType: 'move_to_folder', actionConfig: { folderId: '' } },
  },
  {
    type: 'action',
    label: 'Change Status',
    defaultConfig: { actionType: 'change_status', actionConfig: { status: '' } },
  },
  {
    type: 'action',
    label: 'Send Email',
    defaultConfig: {
      actionType: 'send_email',
      actionConfig: { to: '', subject: '', body: '' },
    },
  },
  {
    type: 'parallel_split',
    label: 'Parallel Split',
    defaultConfig: {},
  },
];

export type PaletteCallbacks = {
  onDragStart: (item: PaletteItem) => void;
};

export function createNodePalette(
  container: HTMLElement,
  callbacks: PaletteCallbacks,
) {
  container.innerHTML = '';
  const heading = document.createElement('h3');
  heading.className = 'wf-palette-heading';
  heading.textContent = 'Nodes';
  container.appendChild(heading);

  for (const item of PALETTE_ITEMS) {
    const el = document.createElement('div');
    el.className = `wf-palette-item wf-palette-item--${item.type}`;
    el.draggable = true;
    el.textContent = item.label;
    el.dataset.nodeType = item.type;

    el.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', JSON.stringify(item));
      callbacks.onDragStart(item);
    });

    container.appendChild(el);
  }
}

/** Get a unique node ID */
let nodeCounter = 0;
export function nextNodeId(type: NodeType): string {
  return `${type}_${++nodeCounter}_${Date.now().toString(36)}`;
}
