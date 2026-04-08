/** Contract: contracts/workflow/rules.md */
import type { WorkflowNode, WorkflowEdge, WorkflowDefinition } from './types.ts';
import * as api from './workflow-api.ts';

export type EditorState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  workflowId: string | null;
  workflowName: string;
  documentId: string;
  triggerType: string;
  connecting: { sourceId: string } | null;
};

export function createInitialState(): EditorState {
  return {
    nodes: [],
    edges: [],
    workflowId: null,
    workflowName: 'Untitled Workflow',
    documentId: '',
    triggerType: 'document.updated',
    connecting: null,
  };
}

export async function saveWorkflow(
  state: EditorState,
  onSuccess: () => void,
): Promise<void> {
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
    onSuccess();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    alert(`Save failed: ${msg}`);
  }
}

export async function toggleActive(
  state: EditorState,
  onSuccess: () => void,
): Promise<void> {
  if (!state.workflowId) return;
  try {
    const current = await api.getWorkflow(state.workflowId);
    await api.updateWorkflow(state.workflowId, { active: !current.active });
    onSuccess();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    alert(`Toggle failed: ${msg}`);
  }
}

export function loadWorkflowIntoState(
  state: EditorState,
  wf: WorkflowDefinition,
): void {
  state.workflowId = wf.id;
  state.workflowName = wf.name;
  state.documentId = wf.documentId;
  state.triggerType = wf.triggerType;

  if (wf.graph) {
    state.nodes = wf.graph.nodes;
    state.edges = wf.graph.edges;
  } else {
    state.nodes = [
      {
        id: 'trigger_1', type: 'trigger', label: wf.triggerType,
        x: 200, y: 50, config: { triggerType: wf.triggerType },
      },
      {
        id: 'action_1', type: 'action', label: wf.actionType,
        x: 200, y: 200, config: { actionType: wf.actionType, actionConfig: wf.actionConfig },
      },
    ];
    state.edges = [
      { id: 'edge_1', sourceId: 'trigger_1', targetId: 'action_1', label: '' },
    ];
  }
}

export function resetState(state: EditorState): void {
  state.workflowId = null;
  state.workflowName = 'Untitled Workflow';
  state.documentId = '';
  state.nodes = [];
  state.edges = [];
}
