/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ExecutionStepLog, NodeType } from '../contract.ts';

function rowToStep(row: Record<string, unknown>): ExecutionStepLog {
  return {
    id: row.id as string,
    executionId: row.execution_id as string,
    nodeId: row.node_id as string,
    nodeType: row.node_type as NodeType,
    input: (row.input as Record<string, unknown>) ?? null,
    output: (row.output as Record<string, unknown>) ?? null,
    durationMs: row.duration_ms as number,
    status: row.status as ExecutionStepLog['status'],
    error: (row.error as string) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export type CreateStep = {
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  durationMs: number;
  status: ExecutionStepLog['status'];
  error?: string;
};

export async function createStep(
  pool: Pool,
  step: CreateStep,
): Promise<ExecutionStepLog> {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO workflow_execution_steps
       (id, execution_id, node_id, node_type, input, output, duration_ms, status, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      id, step.executionId, step.nodeId, step.nodeType,
      step.input ? JSON.stringify(step.input) : null,
      step.output ? JSON.stringify(step.output) : null,
      step.durationMs, step.status, step.error ?? null,
    ],
  );
  return rowToStep(rows[0]);
}

export async function listSteps(
  pool: Pool,
  executionId: string,
): Promise<ExecutionStepLog[]> {
  const { rows } = await pool.query(
    `SELECT * FROM workflow_execution_steps
     WHERE execution_id = $1 ORDER BY created_at ASC`,
    [executionId],
  );
  return rows.map(rowToStep);
}
