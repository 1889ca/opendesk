/** Contract: contracts/kb/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { KBRelationship } from './types.ts';
import { type CreateRelationshipInput, CreateRelationshipInputSchema } from './schemas.ts';

// --- Row mapping ---

interface RelRow {
  id: string;
  workspace_id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function rowToRelationship(row: RelRow): KBRelationship {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sourceId: row.source_id,
    targetId: row.target_id,
    relationType: row.relation_type,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export interface KbRelationshipStore {
  createRelationship(input: CreateRelationshipInput): Promise<KBRelationship>;
  deleteRelationship(workspaceId: string, id: string): Promise<boolean>;
  getRelationships(
    workspaceId: string,
    entryId: string,
    direction?: 'outgoing' | 'incoming' | 'both',
  ): Promise<KBRelationship[]>;
  getRelationshipById(workspaceId: string, id: string): Promise<KBRelationship | null>;
}

export function createKbRelationshipStore(pool: Pool): KbRelationshipStore {
  async function createRelationship(input: CreateRelationshipInput): Promise<KBRelationship> {
    const validated = CreateRelationshipInputSchema.parse(input);
    const id = randomUUID();

    // Verify both source and target exist in the same workspace
    const check = await pool.query(
      `SELECT id FROM kb_entries
       WHERE id IN ($1, $2) AND workspace_id = $3`,
      [validated.sourceId, validated.targetId, validated.workspaceId],
    );

    if (check.rows.length < 2) {
      throw new Error('Source and target entries must exist in the same workspace');
    }

    const result = await pool.query<RelRow>(
      `INSERT INTO kb_relationships (id, workspace_id, source_id, target_id, relation_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        validated.workspaceId,
        validated.sourceId,
        validated.targetId,
        validated.relationType,
        JSON.stringify(validated.metadata),
      ],
    );

    return rowToRelationship(result.rows[0]);
  }

  async function deleteRelationship(workspaceId: string, id: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM kb_relationships WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async function getRelationships(
    workspaceId: string,
    entryId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
  ): Promise<KBRelationship[]> {
    let condition: string;
    const params: unknown[] = [workspaceId];

    switch (direction) {
      case 'outgoing':
        condition = 'source_id = $2';
        params.push(entryId);
        break;
      case 'incoming':
        condition = 'target_id = $2';
        params.push(entryId);
        break;
      case 'both':
        condition = '(source_id = $2 OR target_id = $2)';
        params.push(entryId);
        break;
    }

    const result = await pool.query<RelRow>(
      `SELECT * FROM kb_relationships
       WHERE workspace_id = $1 AND ${condition}
       ORDER BY created_at DESC`,
      params,
    );

    return result.rows.map(rowToRelationship);
  }

  async function getRelationshipById(
    workspaceId: string,
    id: string,
  ): Promise<KBRelationship | null> {
    const result = await pool.query<RelRow>(
      'SELECT * FROM kb_relationships WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId],
    );
    return result.rows[0] ? rowToRelationship(result.rows[0]) : null;
  }

  return { createRelationship, deleteRelationship, getRelationships, getRelationshipById };
}
