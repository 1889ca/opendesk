/** Contract: contracts/workflow/rules.md */
import type { WorkflowNode, WorkflowEdge } from './types.ts';
import {
  labeledInput,
  renderTriggerConfig,
  renderConditionConfig,
  renderActionConfig,
} from './prop-renderers.ts';

export type PropertiesCallbacks = {
  onNodeUpdate: (nodeId: string, changes: Partial<WorkflowNode>) => void;
  onEdgeUpdate: (edgeId: string, changes: Partial<WorkflowEdge>) => void;
  onNodeDelete: (nodeId: string) => void;
  onEdgeDelete: (edgeId: string) => void;
};

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export function createPropertiesPanel(
  container: HTMLElement,
  callbacks: PropertiesCallbacks,
) {
  function renderEmpty() {
    container.innerHTML = '';
    container.appendChild(
      el('p', 'wf-prop-empty', 'Select a node or edge to edit properties'),
    );
  }

  function renderNode(node: WorkflowNode) {
    container.innerHTML = '';
    container.appendChild(
      el('h3', 'wf-prop-heading', `${node.type.replace('_', ' ')} node`),
    );

    container.appendChild(
      labeledInput('Label', node.label, (val) => {
        callbacks.onNodeUpdate(node.id, { label: val });
      }),
    );

    if (node.type === 'trigger') {
      renderTriggerConfig(container, node, callbacks.onNodeUpdate);
    } else if (node.type === 'condition') {
      renderConditionConfig(container, node, callbacks.onNodeUpdate);
    } else if (node.type === 'action') {
      renderActionConfig(container, node, callbacks.onNodeUpdate);
    }

    const delBtn = el('button', 'wf-prop-delete', 'Delete node');
    delBtn.addEventListener('click', () => callbacks.onNodeDelete(node.id));
    container.appendChild(delBtn);
  }

  function renderEdge(edge: WorkflowEdge) {
    container.innerHTML = '';
    container.appendChild(el('h3', 'wf-prop-heading', 'Edge'));

    container.appendChild(
      labeledInput('Label', edge.label, (val) => {
        callbacks.onEdgeUpdate(edge.id, { label: val });
      }),
    );

    const delBtn = el('button', 'wf-prop-delete', 'Delete edge');
    delBtn.addEventListener('click', () => callbacks.onEdgeDelete(edge.id));
    container.appendChild(delBtn);
  }

  renderEmpty();
  return { renderNode, renderEdge, renderEmpty };
}
