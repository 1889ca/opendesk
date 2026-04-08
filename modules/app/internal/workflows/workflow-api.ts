/** Contract: contracts/workflow/rules.md */
import type { WorkflowDefinition, WorkflowExecution, ExecutionStepLog, WorkflowGraph } from './types.ts';

const BASE = '/api/workflows';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function listAllWorkflows(): Promise<WorkflowDefinition[]> {
  return request<WorkflowDefinition[]>(`${BASE}/all`);
}

export function getWorkflow(id: string): Promise<WorkflowDefinition> {
  return request<WorkflowDefinition>(`${BASE}/${id}`);
}

export function createWorkflow(data: {
  name: string;
  documentId: string;
  triggerType: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  graph?: WorkflowGraph;
}): Promise<WorkflowDefinition> {
  return request<WorkflowDefinition>(BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateWorkflow(
  id: string,
  data: Partial<{
    name: string;
    triggerType: string;
    actionType: string;
    actionConfig: Record<string, unknown>;
    graph: WorkflowGraph;
    active: boolean;
  }>,
): Promise<WorkflowDefinition> {
  return request<WorkflowDefinition>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteWorkflow(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
}

export function listExecutions(workflowId: string): Promise<WorkflowExecution[]> {
  return request<WorkflowExecution[]>(`${BASE}/${workflowId}/executions`);
}

export function getExecutionSteps(
  workflowId: string,
  executionId: string,
): Promise<ExecutionStepLog[]> {
  return request<ExecutionStepLog[]>(
    `${BASE}/${workflowId}/executions/${executionId}/steps`,
  );
}
