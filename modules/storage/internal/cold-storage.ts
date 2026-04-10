/** Contract: contracts/storage/rules.md */
import {
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { Pool } from 'pg';
import type { S3Client } from '@aws-sdk/client-s3';

export interface ColdStorageAdapter {
  archiveToCold(docId: string): Promise<void>;
  warmFromCold(docId: string): Promise<void>;
}

/**
 * Row shape fetched before archiving: snapshot + state_vector from the hot tier.
 */
interface HotRow {
  snapshot: unknown;
  state_vector: Buffer | null;
  revision_id: string | null;
}

/**
 * Shape of the JSON object written to S3 for cold-archived documents.
 */
interface ColdObject {
  docId: string;
  snapshot: unknown;
  stateVector: string | null; // base64-encoded Buffer
  revisionId: string | null;
  archivedAt: string; // ISO-8601
}

function coldKey(docId: string): string {
  return `cold/${docId}.json`;
}

/**
 * Factory for the cold storage adapter.
 *
 * Encapsulates the logic for moving document data between
 * PostgreSQL (hot tier) and S3 (cold tier). Both directions
 * are fully reversible and leave the PG row as the single
 * source of truth for document metadata.
 */
export function createColdStorageAdapter(
  pool: Pool,
  s3: S3Client,
  bucket: string,
): ColdStorageAdapter {
  return {
    async archiveToCold(docId: string): Promise<void> {
      const result = await pool.query<HotRow>(
        'SELECT snapshot, state_vector, revision_id FROM documents WHERE id = $1',
        [docId],
      );
      const row = result.rows[0];
      if (!row) throw new Error(`archiveToCold: document not found — ${docId}`);

      const key = coldKey(docId);
      const payload: ColdObject = {
        docId,
        snapshot: row.snapshot,
        stateVector: row.state_vector
          ? Buffer.from(row.state_vector).toString('base64')
          : null,
        revisionId: row.revision_id,
        archivedAt: new Date().toISOString(),
      };

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: JSON.stringify(payload),
          ContentType: 'application/json',
        }),
      );

      await pool.query(
        `UPDATE documents
         SET tier        = 'cold',
             cold_key    = $2,
             archived_at = NOW(),
             snapshot    = NULL,
             state_vector = NULL
         WHERE id = $1`,
        [docId, key],
      );
    },

    async warmFromCold(docId: string): Promise<void> {
      const metaResult = await pool.query<{ cold_key: string | null }>(
        'SELECT cold_key FROM documents WHERE id = $1',
        [docId],
      );
      const meta = metaResult.rows[0];
      if (!meta) throw new Error(`warmFromCold: document not found — ${docId}`);
      if (!meta.cold_key) throw new Error(`warmFromCold: document has no cold_key — ${docId}`);

      const response = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: meta.cold_key }),
      );
      if (!response.Body) throw new Error(`warmFromCold: empty S3 response for ${meta.cold_key}`);

      const raw = await response.Body.transformToString('utf-8');
      const obj: ColdObject = JSON.parse(raw);

      const stateVector = obj.stateVector
        ? Buffer.from(obj.stateVector, 'base64')
        : null;

      await pool.query(
        `UPDATE documents
         SET tier         = 'hot',
             snapshot     = $2,
             state_vector = $3,
             archived_at  = NULL,
             cold_key     = NULL
         WHERE id = $1`,
        [docId, JSON.stringify(obj.snapshot), stateVector],
      );
    },
  };
}

/**
 * Lifecycle policy: archive hot documents that have not been updated
 * within `thresholdDays` days. Processes up to 100 documents per call
 * to avoid long-running batch operations.
 */
export async function archiveStaleDocuments(
  pool: Pool,
  adapter: ColdStorageAdapter,
  thresholdDays: number,
): Promise<void> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM documents
     WHERE tier = 'hot'
       AND updated_at < NOW() - ($1 || ' days')::INTERVAL
     LIMIT 100`,
    [String(thresholdDays)],
  );
  for (const row of result.rows) {
    await adapter.archiveToCold(row.id).catch(console.error);
  }
}
