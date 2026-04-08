/** Contract: contracts/app/rules.md */

export interface WorkflowDef {
  id: string;
  documentId: string;
  name: string;
  triggerType: string;
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

export const TRIGGER_LABELS: Record<string, string> = {
  'document.updated': 'Document Updated',
  'document.exported': 'Document Exported',
  'grant.created': 'Access Granted',
  'grant.revoked': 'Access Revoked',
};

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
