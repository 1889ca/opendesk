/** Contract: contracts/kb/rules.md */

/**
 * PostgreSQL-backed dataset store.
 * Uses two tables: kb_datasets (metadata + rows as JSONB) and
 * kb_sheet_links (dataset <-> document linking).
 */

import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import type {
  Dataset,
  DatasetRow,
  DatasetStore,
  CreateDatasetInput,
  SheetLink,
} from '../contract.ts';

interface DatasetDbRow {
  id: string;
  name: string;
  columns: string[];
  rows: DatasetRow[];
  created_at: Date;
  updated_at: Date;
}

interface SheetLinkDbRow {
  dataset_id: string;
  document_id: string;
  linked_at: Date;
}

function toDataset(row: DatasetDbRow): Dataset {
  return {
    id: row.id,
    name: row.name,
    columns: row.columns,
    rows: row.rows || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toSheetLink(row: SheetLinkDbRow): SheetLink {
  return {
    datasetId: row.dataset_id,
    documentId: row.document_id,
    linkedAt: row.linked_at.toISOString(),
  };
}

export function createPgDatasetStore(pool: pg.Pool): DatasetStore {
  return {
    async list(): Promise<Dataset[]> {
      const result = await pool.query<DatasetDbRow>(
        'SELECT * FROM kb_datasets ORDER BY updated_at DESC',
      );
      return result.rows.map(toDataset);
    },

    async get(id: string): Promise<Dataset | null> {
      const result = await pool.query<DatasetDbRow>(
        'SELECT * FROM kb_datasets WHERE id = $1',
        [id],
      );
      return result.rows[0] ? toDataset(result.rows[0]) : null;
    },

    async create(input: CreateDatasetInput): Promise<Dataset> {
      const id = randomUUID();
      const now = new Date();
      await pool.query(
        `INSERT INTO kb_datasets (id, name, columns, rows, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [id, input.name, JSON.stringify(input.columns),
         JSON.stringify(input.rows), now],
      );
      return {
        id,
        name: input.name,
        columns: input.columns,
        rows: input.rows,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    },

    async updateRows(
      id: string,
      rows: DatasetRow[],
    ): Promise<Dataset | null> {
      const result = await pool.query<DatasetDbRow>(
        `UPDATE kb_datasets SET rows = $2, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id, JSON.stringify(rows)],
      );
      return result.rows[0] ? toDataset(result.rows[0]) : null;
    },

    async delete(id: string): Promise<boolean> {
      // Cascade: remove sheet links first
      await pool.query(
        'DELETE FROM kb_sheet_links WHERE dataset_id = $1',
        [id],
      );
      const result = await pool.query(
        'DELETE FROM kb_datasets WHERE id = $1',
        [id],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async linkSheet(
      datasetId: string,
      documentId: string,
    ): Promise<SheetLink> {
      // Upsert: a sheet links to at most one dataset
      const now = new Date();
      await pool.query(
        `INSERT INTO kb_sheet_links (dataset_id, document_id, linked_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (document_id)
         DO UPDATE SET dataset_id = $1, linked_at = $3`,
        [datasetId, documentId, now],
      );
      return {
        datasetId,
        documentId,
        linkedAt: now.toISOString(),
      };
    },

    async unlinkSheet(documentId: string): Promise<boolean> {
      const result = await pool.query(
        'DELETE FROM kb_sheet_links WHERE document_id = $1',
        [documentId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async getLinkedDataset(documentId: string): Promise<Dataset | null> {
      const result = await pool.query<DatasetDbRow>(
        `SELECT d.* FROM kb_datasets d
         JOIN kb_sheet_links l ON l.dataset_id = d.id
         WHERE l.document_id = $1`,
        [documentId],
      );
      return result.rows[0] ? toDataset(result.rows[0]) : null;
    },

    async getSheetLink(documentId: string): Promise<SheetLink | null> {
      const result = await pool.query<SheetLinkDbRow>(
        'SELECT * FROM kb_sheet_links WHERE document_id = $1',
        [documentId],
      );
      return result.rows[0] ? toSheetLink(result.rows[0]) : null;
    },
  };
}
