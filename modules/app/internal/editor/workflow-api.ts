/** Contract: contracts/app/rules.md */
import { apiFetch } from '../shared/api-client.ts';
import type { WorkflowDef, WorkflowExecution } from './workflow-types.ts';

export async function fetchWorkflows(docId: string): Promise<WorkflowDef[]> {
  const res = await apiFetch(`/api/workflows?documentId=${encodeURIComponent(docId)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function createWorkflow(data: Record<string, unknown>): Promise<WorkflowDef | null> {
  const res = await apiFetch('/api/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateWorkflow(id: string, data: Record<string, unknown>): Promise<boolean> {
  const res = await apiFetch(`/api/workflows/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.ok;
}

export async function fetchExecutions(workflowId: string): Promise<WorkflowExecution[]> {
  const res = await apiFetch(`/api/workflows/${encodeURIComponent(workflowId)}/executions?limit=20`);
  if (!res.ok) return [];
  return res.json();
}
