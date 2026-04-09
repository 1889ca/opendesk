/** Contract: contracts/workflow/rules.md */
import type { WorkflowDefinition } from './types.ts';
import * as api from './workflow-api.ts';

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export type WorkflowListCallbacks = {
  onSelect: (workflow: WorkflowDefinition) => void;
  onNew: () => void;
};

export function createWorkflowList(
  container: HTMLElement,
  callbacks: WorkflowListCallbacks,
) {
  async function refresh() {
    container.innerHTML = '';

    const header = el('div', 'wf-list-header');
    const title = el('h2', 'wf-list-title', 'Workflows');
    const newBtn = el('button', 'wf-list-new-btn', '+ New');
    newBtn.addEventListener('click', () => callbacks.onNew());
    header.appendChild(title);
    header.appendChild(newBtn);
    container.appendChild(header);

    let workflows: WorkflowDefinition[];
    try {
      workflows = await api.listAllWorkflows();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      container.appendChild(el('p', 'wf-list-error', `Error: ${msg}`));
      return;
    }

    if (workflows.length === 0) {
      container.appendChild(el('p', 'wf-list-empty', 'No workflows yet'));
      return;
    }

    const list = el('div', 'wf-list-items');
    for (const wf of workflows) {
      const item = el('div', 'wf-list-item');
      const name = el('span', 'wf-list-item-name', wf.name);
      const trigger = el('span', 'wf-list-item-trigger', wf.triggerType);
      const status = el('span',
        `wf-list-item-status ${wf.active ? 'wf-list-item--active' : 'wf-list-item--inactive'}`,
        wf.active ? 'Active' : 'Inactive',
      );
      item.appendChild(name);
      item.appendChild(trigger);
      item.appendChild(status);
      item.addEventListener('click', () => callbacks.onSelect(wf));
      list.appendChild(item);
    }
    container.appendChild(list);
  }

  refresh();
  return { refresh };
}
