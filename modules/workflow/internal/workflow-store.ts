/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type {
  WorkflowDefinition,
  CreateWorkflow,
  UpdateWorkflow,
  TriggerType,
  WorkflowGraph,
} from '../contract.ts';

function rowToDefinition(row: Record<string, unknown>): WorkflowDefinition {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    name: row.name as string,
    triggerType: row.trigger_type as TriggerType,
    actionType: row.action_type as WorkflowDefinition['actionType'],
    actionConfig: row.action_config as Record<string, unknown>,
    graph: (row.graph as WorkflowGraph) ?? undefined,
    createdBy: row.created_by as string,
    active: row.active as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function createDefinition(
  pool: Pool,
  def: CreateWorkflow,
  createdBy: string,
): Promise<WorkflowDefinition> {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO workflow_definitions
       (id, document_id, name, trigger_type, action_type, action_config, graph, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id, def.documentId, def.name, def.triggerType,
      def.actionType, JSON.stringify(def.actionConfig),
      def.graph ? JSON.stringify(def.graph) : null,
      createdBy,
    ],
  );
  return rowToDefinition(rows[0]);
}

export async function getDefinition(
  pool: Pool,
  id: string,
): Promise<WorkflowDefinition | null> {
  const { rows } = await pool.query(
    'SELECT * FROM workflow_definitions WHERE id = $1',
    [id],
  );
  return rows.length > 0 ? rowToDefinition(rows[0]) : null;
}

export async function listDefinitions(
  pool: Pool,
  documentId: string,
): Promise<WorkflowDefinition[]> {
  const { rows } = await pool.query(
    `SELECT * FROM workflow_definitions
     WHERE document_id = $1 AND active = true
     ORDER BY created_at DESC`,
    [documentId],
  );
  return rows.map(rowToDefinition);
}

export async function listAllDefinitions(
  pool: Pool,
): Promise<WorkflowDefinition[]> {
  const { rows } = await pool.query(
    `SELECT * FROM workflow_definitions
     WHERE active = true ORDER BY created_at DESC`,
  );
  return rows.map(rowToDefinition);
}

export async function updateDefinition(
  pool: Pool,
  id: string,
  updates: UpdateWorkflow,
): Promise<WorkflowDefinition | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    values.push(updates.name);
  }
  if (updates.triggerType !== undefined) {
    setClauses.push(`trigger_type = $${paramIdx++}`);
    values.push(updates.triggerType);
  }
  if (updates.actionType !== undefined) {
    setClauses.push(`action_type = $${paramIdx++}`);
    values.push(updates.actionType);
  }
  if (updates.actionConfig !== undefined) {
    setClauses.push(`action_config = $${paramIdx++}`);
    values.push(JSON.stringify(updates.actionConfig));
  }
  if (updates.graph !== undefined) {
    setClauses.push(`graph = $${paramIdx++}`);
    values.push(JSON.stringify(updates.graph));
  }
  if (updates.active !== undefined) {
    setClauses.push(`active = $${paramIdx++}`);
    values.push(updates.active);
  }

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE workflow_definitions SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx} RETURNING *`,
    values,
  );
  return rows.length > 0 ? rowToDefinition(rows[0]) : null;
}

export async function deleteDefinition(
  pool: Pool,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM workflow_definitions WHERE id = $1',
    [id],
  );
  return (rowCount ?? 0) > 0;
}

export async function findByTrigger(
  pool: Pool,
  triggerType: TriggerType,
  documentId: string,
): Promise<WorkflowDefinition[]> {
  const { rows } = await pool.query(
    `SELECT * FROM workflow_definitions
     WHERE trigger_type = $1 AND document_id = $2 AND active = true`,
    [triggerType, documentId],
  );
  return rows.map(rowToDefinition);
}
