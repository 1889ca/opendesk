/** Contract: contracts/workflow/rules.md */
import type { WorkflowNode, PaletteItem } from './types.ts';
import { createCanvasRenderer } from './canvas-renderer.ts';
import { createNodePalette, nextNodeId } from './node-palette.ts';
import { createPropertiesPanel } from './properties-panel.ts';
import { createExecutionLog } from './execution-log.ts';
import { createWorkflowList } from './workflow-list.ts';
import { createEditorLayout } from './editor-layout.ts';
import {
  createInitialState, saveWorkflow, toggleActive,
  loadWorkflowIntoState, resetState,
} from './editor-actions.ts';

export function initWorkflowEditor(root: HTMLElement) {
  const state = createInitialState();
  const els = createEditorLayout(root);

  const canvas = createCanvasRenderer(els.canvasEl, {
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
      if (node) { node.x = x; node.y = y; rerender(); }
    },
    onEdgeSelect(edgeId) {
      if (edgeId) {
        const edge = state.edges.find((e) => e.id === edgeId);
        if (edge) props.renderEdge(edge);
      } else { props.renderEmpty(); }
    },
  });

  const props = createPropertiesPanel(els.propsEl, {
    onNodeUpdate(nodeId, changes) {
      const idx = state.nodes.findIndex((n) => n.id === nodeId);
      if (idx >= 0) {
        state.nodes[idx] = { ...state.nodes[idx], ...changes };
        rerender();
        props.renderNode(state.nodes[idx]);
      }
    },
    onEdgeUpdate(edgeId, changes) {
      const idx = state.edges.findIndex((e) => e.id === edgeId);
      if (idx >= 0) { state.edges[idx] = { ...state.edges[idx], ...changes }; rerender(); }
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

  createNodePalette(els.paletteEl, {
    onDragStart(_item: PaletteItem) { /* CSS handles visual feedback */ },
  });

  setupDragDrop(els.canvasEl, state, rerender);
  setupPortConnections(els.canvasEl, state, rerender);

  let execLog: ReturnType<typeof createExecutionLog> | null = null;
  els.execBtn.addEventListener('click', () => {
    if (!state.workflowId) return;
    if (!execLog) execLog = createExecutionLog(els.execEl, state.workflowId);
    execLog.toggle();
  });

  els.saveBtn.addEventListener('click', () => {
    state.workflowName = els.nameInput.value || 'Untitled Workflow';
    state.documentId = els.docIdInput.value;
    saveWorkflow(state, () => workflowList.refresh());
  });

  els.toggleBtn.addEventListener('click', () => {
    toggleActive(state, () => workflowList.refresh());
  });

  els.nameInput.addEventListener('input', () => {
    state.workflowName = els.nameInput.value;
  });

  const workflowList = createWorkflowList(els.listEl, {
    onSelect(wf) {
      loadWorkflowIntoState(state, wf);
      els.nameInput.value = state.workflowName;
      els.docIdInput.value = state.documentId;
      execLog = createExecutionLog(els.execEl, wf.id);
      rerender();
    },
    onNew() {
      resetState(state);
      els.nameInput.value = '';
      els.docIdInput.value = '';
      props.renderEmpty();
      rerender();
    },
  });

  function rerender() { canvas.render(state.nodes, state.edges); }
}

function setupDragDrop(
  canvasEl: HTMLElement,
  state: { nodes: WorkflowNode[] },
  rerender: () => void,
) {
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
    state.nodes.push({
      id: nextNodeId(item.type),
      type: item.type, label: item.label,
      x, y, config: { ...item.defaultConfig },
    });
    rerender();
  });
}

function setupPortConnections(
  canvasEl: HTMLElement,
  state: { edges: { id: string; sourceId: string; targetId: string; label: string }[]; connecting: { sourceId: string } | null },
  rerender: () => void,
) {
  canvasEl.addEventListener('click', (e) => {
    const port = (e.target as Element).closest('.wf-port-out, .wf-port-true, .wf-port-false');
    if (port) {
      const nodeEl = port.closest('[data-node-id]');
      if (nodeEl) {
        const sourceId = nodeEl.getAttribute('data-node-id')!;
        const label = port.classList.contains('wf-port-true') ? 'true'
          : port.classList.contains('wf-port-false') ? 'false' : '';
        state.connecting = { sourceId };
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
          state.edges.push({
            id: `edge_${Date.now().toString(36)}`,
            sourceId: state.connecting.sourceId,
            targetId,
            label: canvasEl.dataset.connectLabel ?? '',
          });
          rerender();
        }
      }
      state.connecting = null;
      delete canvasEl.dataset.connectLabel;
      canvasEl.classList.remove('wf-connecting');
    }
  });
}
