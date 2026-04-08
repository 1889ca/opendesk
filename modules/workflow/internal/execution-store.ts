/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { WorkflowExecution, ExecutionStatus } from '../contract.ts';

function rowToExecution(row: Record<string, unknown>): WorkflowExecution {
  return {
    id: row.id as string,
    workflowId: row.workflow_id as string,
    triggerEventId: row.trigger_event_id as string,
    status: row.status as ExecutionStatus,
    startedAt: (row.started_at as Date).toISOString(),
    completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
    error: (row.error as string) ?? null,
  };
}

export async function createExecution(
  pool: Pool,
  workflowId: string,
  triggerEventId: string,
  status: ExecutionStatus = 'running',
): Promise<WorkflowExecution> {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO workflow_executions (id, workflow_id, trigger_event_id, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, workflowId, triggerEventId, status],
  );
  return rowToExecution(rows[0]);
}

export async function updateExecution(
  pool: Pool,
  id: string,
  updates: { status: ExecutionStatus; error?: string },
): Promise<void> {
  const completedAt = updates.status === 'completed' || updates.status === 'failed'
    ? 'NOW()'
    : 'NULL';
  await pool.query(
    `UPDATE workflow_executions
     SET status = $1, error = $2, completed_at = ${completedAt}
     WHERE id = $3`,
    [updates.status, updates.error ?? null, id],
  );
}

export async function listExecutions(
  pool: Pool,
  workflowId: string,
  limit = 50,
): Promise<WorkflowExecution[]> {
  const { rows } = await pool.query(
    'SELECT * FROM workflow_executions WHERE workflow_id = $1 ORDER BY started_at DESC LIMIT $2',
    [workflowId, limit],
  );
  return rows.map(rowToExecution);
}
