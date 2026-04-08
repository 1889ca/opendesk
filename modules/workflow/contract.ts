/** Contract: contracts/workflow/rules.md */
import { z } from 'zod';

// --- Trigger & Action Enums ---

export const TriggerTypeSchema = z.enum([
  'document.updated',
  'document.exported',
  'grant.created',
  'grant.revoked',
]);

export type TriggerType = z.infer<typeof TriggerTypeSchema>;

export const ActionTypeSchema = z.enum(['webhook', 'export', 'notify']);

export type ActionType = z.infer<typeof ActionTypeSchema>;

// --- Action Config Schemas ---

export const WebhookConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

export const ExportConfigSchema = z.object({
  format: z.enum(['docx', 'odt', 'pdf']),
});

export type ExportConfig = z.infer<typeof ExportConfigSchema>;

export const NotifyConfigSchema = z.object({
  message: z.string().min(1),
});

export type NotifyConfig = z.infer<typeof NotifyConfigSchema>;

// --- Workflow Definition ---

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const WorkflowDefinitionSchema = z.object({
  id: z.string().regex(uuidv4Regex),
  documentId: z.string().min(1),
  name: z.string().min(1).max(200),
  triggerType: TriggerTypeSchema,
  actionType: ActionTypeSchema,
  actionConfig: z.record(z.unknown()),
  createdBy: z.string().min(1),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// --- Create / Update Schemas ---

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  documentId: z.string().min(1),
  triggerType: TriggerTypeSchema,
  actionType: ActionTypeSchema,
  actionConfig: z.record(z.unknown()),
});

export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  triggerType: TriggerTypeSchema.optional(),
  actionType: ActionTypeSchema.optional(),
  actionConfig: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});

export type UpdateWorkflow = z.infer<typeof UpdateWorkflowSchema>;

// --- Execution ---

export const ExecutionStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
]);

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

// --- Module Interface ---

export interface WorkflowModule {
  createDefinition(def: CreateWorkflow, createdBy: string): Promise<WorkflowDefinition>;
  getDefinition(id: string): Promise<WorkflowDefinition | null>;
  listDefinitions(documentId: string): Promise<WorkflowDefinition[]>;
  updateDefinition(id: string, updates: UpdateWorkflow): Promise<WorkflowDefinition | null>;
  deleteDefinition(id: string): Promise<boolean>;
  listExecutions(workflowId: string, limit?: number): Promise<WorkflowExecution[]>;
  startConsuming(): Promise<void>;
}
