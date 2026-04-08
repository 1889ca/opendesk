/** Contract: contracts/workflow/rules.md */
import type { WorkflowNode, WorkflowEdge, WorkflowDefinition, PaletteItem } from './types.ts';
import { createCanvasRenderer } from './canvas-renderer.ts';
import { createNodePalette, nextNodeId } from './node-palette.ts';
import { createPropertiesPanel } from './properties-panel.ts';
import { createExecutionLog } from './execution-log.ts';
import { createWorkflowList } from './workflow-list.ts';
import * as api from './workflow-api.ts';

type EditorState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  workflowId: string | null;
  workflowName: string;
  documentId: string;
  triggerType: string;
  connecting: { sourceId: string } | null;
};

export function initWorkflowEditor(root: HTMLElement) {
  const state: EditorState = {
    nodes: [],
    edges: [],
    workflowId: null,
    workflowName: 'Untitled Workflow',
    documentId: '',
    triggerType: 'document.updated',
    connecting: null,
  };

  // Build DOM structure
  root.innerHTML = `
    <div class="wf-editor">
      <aside class="wf-sidebar-left">
        <div class="wf-list-container"></div>
        <div class="wf-palette-container"></div>
      </aside>
      <main class="wf-main">
        <div class="wf-toolbar">
          <input class="wf-name-input" placeholder="Workflow name" />
          <input class="wf-docid-input" placeholder="Document ID" />
          <button class="wf-save-btn">Save</button>
          <button class="wf-toggle-btn">Toggle Active</button>
          <button class="wf-exec-btn">Execution Log</button>
        </div>
        <div class="wf-canvas-container"></div>
        <div class="wf-exec-container"></div>
      </main>
      <aside class="wf-sidebar-right">
        <div class="wf-props-container"></div>
      </aside>
    </div>
  `;

  const listEl = root.querySelector('.wf-list-container') as HTMLElement;
  const paletteEl = root.querySelector('.wf-palette-container') as HTMLElement;
  const canvasEl = root.querySelector('.wf-canvas-container') as HTMLElement;
  const propsEl = root.querySelector('.wf-props-container') as HTMLElement;
  const execEl = root.querySelector('.wf-exec-container') as HTMLElement;
  const nameInput = root.querySelector('.wf-name-input') as HTMLInputElement;
  const docIdInput = root.querySelector('.wf-docid-input') as HTMLInputElement;
  const saveBtn = root.querySelector('.wf-save-btn') as HTMLButtonElement;
  const toggleBtn = root.querySelector('.wf-toggle-btn') as HTMLButtonElement;
  const execBtn = root.querySelector('.wf-exec-btn') as HTMLButtonElement;

  // Canvas renderer
  const canvas = createCanvasRenderer(canvasEl, {
    onNodeSelect(nodeId) {
      canvas.setSelected(nodeId);
      if (nodeId) {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) props.renderNode(node);
      } else {
        props.renderEmpty();
      }
      rerender();
    },
    onNodeMove(nodeId, x, y) {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.x = x;
        node.y = y;
        rerender();
      }
    },
    onEdgeSelect(edgeId) {
      if (edgeId) {
        const edge = state.edges.find((e) => e.id === edgeId);
        if (edge) props.renderEdge(edge);
      } else {
        props.renderEmpty();
      }
    },
  });

  // Properties panel
  const props = createPropertiesPanel(propsEl, {
    onNodeUpdate(nodeId, changes) {
      const idx = state.nodes.findIndex((n) => n.id === nodeId);
      if (idx >= 0) {
        state.nodes[idx] = { ...state.nodes[idx], ...changes };
        rerender();
        // Re-render properties to reflect changes
        props.renderNode(state.nodes[idx]);
      }
    },
    onEdgeUpdate(edgeId, changes) {
      const idx = state.edges.findIndex((e) => e.id === edgeId);
      if (idx >= 0) {
        state.edges[idx] = { ...state.edges[idx], ...changes };
        rerender();
      }
    },
    onNodeDelete(nodeId) {
      state.nodes = state.nodes.filter((n) => n.id !== nodeId);
      state.edges = state.edges.filter(
        (e) => e.sourceId !== nodeId && e.targetId !== nodeId,
      );
      props.renderEmpty();
      rerender();
    },
    onEdgeDelete(edgeId) {
      state.edges = state.edges.filter((e) => e.id !== edgeId);
      props.renderEmpty();
      rerender();
    },
  });

  // Node palette
  createNodePalette(paletteEl, {
    onDragStart(_item: PaletteItem) { /* visual feedback handled by CSS */ },
  });

  // Handle drop on canvas
  canvasEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  });

  canvasEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const data = e.dataTransfer?.getData('text/plain');
    if (!data) return;
    const item: PaletteItem = JSON.parse(data);
    const rect = canvasEl.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / 10) * 10;
    const y = Math.round((e.clientY - rect.top) / 10) * 10;
    const node: WorkflowNode = {
      id: nextNodeId(item.type),
      type: item.type,
      label: item.label,
      x,
      y,
      config: { ...item.defaultConfig },
    };
    state.nodes.push(node);
    rerender();
  });

  // Connect nodes via port clicking
  canvasEl.addEventListener('click', (e) => {
    const port = (e.target as Element).closest('.wf-port-out, .wf-port-true, .wf-port-false');
    if (port) {
      const nodeEl = port.closest('[data-node-id]');
      if (nodeEl) {
        const sourceId = nodeEl.getAttribute('data-node-id')!;
        const label = port.classList.contains('wf-port-true') ? 'true'
          : port.classList.contains('wf-port-false') ? 'false'
          : '';
        state.connecting = { sourceId };
        // Store label in data attribute for next click
        canvasEl.dataset.connectLabel = label;
        canvasEl.classList.add('wf-connecting');
      }
      return;
    }
    const inPort = (e.target as Element).closest('.wf-port-in');
    if (inPort && state.connecting) {
      const nodeEl = inPort.closest('[data-node-id]');
      if (nodeEl) {
        const targetId = nodeEl.getAttribute('data-node-id')!;
        if (targetId !== state.connecting.sourceId) {
          const edgeLabel = canvasEl.dataset.connectLabel ?? '';
          state.edges.push({
            id: `edge_${Date.now().toString(36)}`,
            sourceId: state.connecting.sourceId,
            targetId,
            label: edgeLabel,
          });
          rerender();
        }
      }
      state.connecting = null;
      delete canvasEl.dataset.connectLabel;
      canvasEl.classList.remove('wf-connecting');
    }
  });

  // Execution log
  let execLog: ReturnType<typeof createExecutionLog> | null = null;

  execBtn.addEventListener('click', () => {
    if (!state.workflowId) return;
    if (!execLog) {
      execLog = createExecutionLog(execEl, state.workflowId);
    }
    execLog.toggle();
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    state.workflowName = nameInput.value || 'Untitled Workflow';
    state.documentId = docIdInput.value;

    if (!state.documentId) {
      alert('Document ID is required');
      return;
    }

    const triggerNode = state.nodes.find((n) => n.type === 'trigger');
    const triggerType = triggerNode
      ? (triggerNode.config.triggerType as string) ?? 'document.updated'
      : 'document.updated';

    const actionNode = state.nodes.find((n) => n.type === 'action');
    const actionType = actionNode
      ? (actionNode.config.actionType as string) ?? 'notify'
      : 'notify';
    const actionConfig = actionNode
      ? (actionNode.config.actionConfig as Record<string, unknown>) ?? {}
      : {};

    const graph = { nodes: state.nodes, edges: state.edges };

    try {
      if (state.workflowId) {
        await api.updateWorkflow(state.workflowId, {
          name: state.workflowName,
          triggerType,
          actionType,
          actionConfig,
          graph,
        });
      } else {
        const created = await api.createWorkflow({
          name: state.workflowName,
          documentId: state.documentId,
          triggerType,
          actionType,
          actionConfig,
          graph,
        });
        state.workflowId = created.id;
      }
      workflowList.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Save failed: ${msg}`);
    }
  });

  // Toggle active
  toggleBtn.addEventListener('click', async () => {
    if (!state.workflowId) return;
    try {
      const current = await api.getWorkflow(state.workflowId);
      await api.updateWorkflow(state.workflowId, { active: !current.active });
      workflowList.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Toggle failed: ${msg}`);
    }
  });

  function loadWorkflow(wf: WorkflowDefinition) {
    state.workflowId = wf.id;
    state.workflowName = wf.name;
    state.documentId = wf.documentId;
    state.triggerType = wf.triggerType;
    nameInput.value = wf.name;
    docIdInput.value = wf.documentId;

    if (wf.graph) {
      state.nodes = wf.graph.nodes;
      state.edges = wf.graph.edges;
    } else {
      // Legacy workflow: create a simple trigger -> action graph
      state.nodes = [
        {
          id: 'trigger_1',
          type: 'trigger',
          label: wf.triggerType,
          x: 200,
          y: 50,
          config: { triggerType: wf.triggerType },
        },
        {
          id: 'action_1',
          type: 'action',
          label: wf.actionType,
          x: 200,
          y: 200,
          config: { actionType: wf.actionType, actionConfig: wf.actionConfig },
        },
      ];
      state.edges = [
        { id: 'edge_1', sourceId: 'trigger_1', targetId: 'action_1', label: '' },
      ];
    }

    execLog = createExecutionLog(execEl, wf.id);
    rerender();
  }

  function newWorkflow() {
    state.workflowId = null;
    state.workflowName = 'Untitled Workflow';
    state.documentId = '';
    state.nodes = [];
    state.edges = [];
    nameInput.value = '';
    docIdInput.value = '';
    props.renderEmpty();
    rerender();
  }

  // Workflow list
  const workflowList = createWorkflowList(listEl, {
    onSelect: loadWorkflow,
    onNew: newWorkflow,
  });

  function rerender() {
    canvas.render(state.nodes, state.edges);
  }

  nameInput.addEventListener('input', () => {
    state.workflowName = nameInput.value;
  });
}
