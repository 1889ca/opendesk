/** Contract: contracts/workflow/rules.md */
import { z } from 'zod';

// Re-export config schemas
export {
  WebhookConfigSchema, type WebhookConfig,
  ExportConfigSchema, type ExportConfig,
  NotifyConfigSchema, type NotifyConfig,
  SetMetadataConfigSchema, type SetMetadataConfig,
  MoveToFolderConfigSchema, type MoveToFolderConfig,
  ChangeStatusConfigSchema, type ChangeStatusConfig,
  SendEmailConfigSchema, type SendEmailConfig,
  WasmPluginConfigSchema, type WasmPluginConfig,
  ConditionOperatorSchema, type ConditionOperator,
  ConditionConfigSchema, type ConditionConfig,
} from './internal/config-schemas.ts';

// --- Trigger & Action Enums ---

export const TriggerTypeSchema = z.enum([
  'document.updated',
  'document.exported',
  'grant.created',
  'grant.revoked',
]);

export type TriggerType = z.infer<typeof TriggerTypeSchema>;

export const ActionTypeSchema = z.enum([
  'webhook', 'export', 'notify',
  'set_metadata', 'move_to_folder', 'change_status', 'send_email',
  'wasm_plugin',
]);

export type ActionType = z.infer<typeof ActionTypeSchema>;

// --- Node Types ---

export const NodeTypeSchema = z.enum([
  'trigger', 'condition', 'action', 'parallel_split',
]);

export type NodeType = z.infer<typeof NodeTypeSchema>;

// --- Graph Node & Edge ---

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: NodeTypeSchema,
  label: z.string().max(100).default(''),
  x: z.number(),
  y: z.number(),
  config: z.record(z.unknown()).default({}),
});

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  label: z.string().max(50).default(''),
});

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

export const WorkflowGraphSchema = z.object({
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
});

export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;

// --- Workflow Definition ---

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const WorkflowDefinitionSchema = z.object({
  id: z.string().regex(uuidv4Regex),
  documentId: z.string().min(1),
  name: z.string().min(1).max(200),
  triggerType: TriggerTypeSchema,
  actionType: ActionTypeSchema,
  actionConfig: z.record(z.unknown()),
  graph: WorkflowGraphSchema.optional(),
  createdBy: z.string().min(1),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// --- Create / Update ---

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  documentId: z.string().min(1),
  triggerType: TriggerTypeSchema,
  actionType: ActionTypeSchema,
  actionConfig: z.record(z.unknown()),
  graph: WorkflowGraphSchema.optional(),
});

export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  triggerType: TriggerTypeSchema.optional(),
  actionType: ActionTypeSchema.optional(),
  actionConfig: z.record(z.unknown()).optional(),
  graph: WorkflowGraphSchema.optional(),
  active: z.boolean().optional(),
});

export type UpdateWorkflow = z.infer<typeof UpdateWorkflowSchema>;

// --- Execution ---

export const ExecutionStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const WorkflowExecutionSchema = z.object({
  id: z.string().regex(uuidv4Regex),
  workflowId: z.string().regex(uuidv4Regex),
  triggerEventId: z.string().regex(uuidv4Regex),
  status: ExecutionStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

// --- Execution Step Log ---

export const ExecutionStepLogSchema = z.object({
  id: z.string().regex(uuidv4Regex),
  executionId: z.string().regex(uuidv4Regex),
  nodeId: z.string().min(1),
  nodeType: NodeTypeSchema,
  input: z.record(z.unknown()).nullable(),
  output: z.record(z.unknown()).nullable(),
  durationMs: z.number().int().min(0),
  status: z.enum(['evaluated', 'executed', 'skipped', 'failed']),
  error: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type ExecutionStepLog = z.infer<typeof ExecutionStepLogSchema>;

// --- Module Interface ---

export interface WorkflowModule {
  createDefinition(def: CreateWorkflow, createdBy: string): Promise<WorkflowDefinition>;
  getDefinition(id: string): Promise<WorkflowDefinition | null>;
  listDefinitions(documentId: string): Promise<WorkflowDefinition[]>;
  listAllDefinitions(): Promise<WorkflowDefinition[]>;
  updateDefinition(id: string, updates: UpdateWorkflow): Promise<WorkflowDefinition | null>;
  deleteDefinition(id: string): Promise<boolean>;
  listExecutions(workflowId: string, limit?: number): Promise<WorkflowExecution[]>;
  getExecutionLog(executionId: string): Promise<ExecutionStepLog[]>;
  startConsuming(): Promise<void>;
}
