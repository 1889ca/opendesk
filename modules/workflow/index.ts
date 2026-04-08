/** Contract: contracts/workflow/rules.md */

// Schemas
export {
  TriggerTypeSchema,
  ActionTypeSchema,
  WebhookConfigSchema,
  ExportConfigSchema,
  NotifyConfigSchema,
  WorkflowDefinitionSchema,
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  ExecutionStatusSchema,
  WorkflowExecutionSchema,
} from './contract.ts';

// Types
export type {
  TriggerType,
  ActionType,
  WebhookConfig,
  ExportConfig,
  NotifyConfig,
  WorkflowDefinition,
  CreateWorkflow,
  UpdateWorkflow,
  ExecutionStatus,
  WorkflowExecution,
  WorkflowModule,
} from './contract.ts';

// Factory
export { createWorkflow, type WorkflowDependencies } from './internal/create-workflow.ts';

// Routes
export { createWorkflowRoutes, type WorkflowRoutesOptions } from './internal/workflow-routes.ts';
