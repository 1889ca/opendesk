/** Contract: contracts/workflow/rules.md */

// Schemas
export {
  TriggerTypeSchema,
  ActionTypeSchema,
  NodeTypeSchema,
  ConditionOperatorSchema,
  WebhookConfigSchema,
  ExportConfigSchema,
  NotifyConfigSchema,
  SetMetadataConfigSchema,
  MoveToFolderConfigSchema,
  ChangeStatusConfigSchema,
  SendEmailConfigSchema,
  WasmPluginConfigSchema,
  ConditionConfigSchema,
  WorkflowNodeSchema,
  WorkflowEdgeSchema,
  WorkflowGraphSchema,
  WorkflowDefinitionSchema,
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  ExecutionStatusSchema,
  WorkflowExecutionSchema,
  ExecutionStepLogSchema,
} from './contract.ts';

// Types
export type {
  TriggerType,
  ActionType,
  NodeType,
  ConditionOperator,
  WebhookConfig,
  ExportConfig,
  NotifyConfig,
  SetMetadataConfig,
  MoveToFolderConfig,
  ChangeStatusConfig,
  SendEmailConfig,
  WasmPluginConfig,
  ConditionConfig,
  WorkflowNode,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowDefinition,
  CreateWorkflow,
  UpdateWorkflow,
  ExecutionStatus,
  WorkflowExecution,
  ExecutionStepLog,
  WorkflowModule,
} from './contract.ts';

// Factory
export { createWorkflow, type WorkflowDependencies } from './internal/create-workflow.ts';

// Routes
export { createWorkflowRoutes, type WorkflowRoutesOptions } from './internal/workflow-routes.ts';

// Plugin routes
export { createPluginRoutes, type PluginRoutesOptions } from './internal/plugin-routes.ts';

// Plugin types
export type { WasmPlugin, CreateWasmPlugin } from './internal/plugin-types.ts';
