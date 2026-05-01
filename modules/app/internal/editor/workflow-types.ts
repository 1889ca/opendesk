/** Contract: contracts/app/rules.md */

export interface WorkflowDef {
  id: string;
  documentId: string;
  name: string;
  triggerType: string;
  triggerConditions: TriggerConditionConfig | null;
  actionType: string;
  actionConfig: Record<string, unknown>;
  active: boolean;
  createdBy: string;
  createdAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

/** UI-facing representation of a leaf trigger condition. */
export interface LeafTriggerConditionConfig {
  type: 'document_version' | 'kb_entity_change' | 'form_submission';
  filter: Record<string, unknown>;
}

/** UI-facing representation of a compound trigger condition. */
export interface CompoundTriggerConditionConfig {
  operator: 'AND' | 'OR';
  conditions: TriggerConditionConfig[];
}

export type TriggerConditionConfig = LeafTriggerConditionConfig | CompoundTriggerConditionConfig;

export const TRIGGER_LABELS: Record<string, string> = {
  'document.updated': 'Document Updated',
  'document.exported': 'Document Exported',
  'grant.created': 'Access Granted',
  'grant.revoked': 'Access Revoked',
  'document.version_created': 'Document Version Created',
  'kb_entity.changed': 'KB Entity Changed',
  'form.submitted': 'Form Submitted',
};

/**
 * Trigger types that require a condition filter to be meaningful.
 * The UI enforces that these triggers must have triggerConditions set.
 */
export const CONDITION_REQUIRED_TRIGGERS = new Set([
  'document.version_created',
  'kb_entity.changed',
  'form.submitted',
]);

export const ACTION_LABELS: Record<string, string> = {
  webhook: 'Webhook',
  export: 'Export',
  notify: 'Notification',
};

export const STATUS_ICONS: Record<string, string> = {
  pending: '\u23F3',
  running: '\u26A1',
  completed: '\u2705',
  failed: '\u274C',
};
