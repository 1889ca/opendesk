/** Contract: contracts/workflow/rules.md */

export type NodeType = 'trigger' | 'condition' | 'action' | 'parallel_split';
export type TriggerType = 'document.updated' | 'document.exported' | 'grant.created' | 'grant.revoked';
export type ActionType = 'webhook' | 'export' | 'notify' | 'set_metadata' | 'move_to_folder' | 'change_status' | 'send_email';
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'includes' | 'not_includes';

export type WorkflowNode = {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
};

export type WorkflowGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type WorkflowDefinition = {
  id: string;
  documentId: string;
  name: string;
  triggerType: TriggerType;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  graph?: WorkflowGraph;
  createdBy: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExecutionStepLog = {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  durationMs: number;
  status: 'evaluated' | 'executed' | 'skipped' | 'failed';
  error: string | null;
  createdAt: string;
};

export type WorkflowExecution = {
  id: string;
  workflowId: string;
  triggerEventId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  error: string | null;
};

/** Node palette items for the drag palette */
export type PaletteItem = {
  type: NodeType;
  label: string;
  defaultConfig: Record<string, unknown>;
};
