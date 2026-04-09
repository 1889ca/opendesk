/** Contract: contracts/observability/rules.md */

import type { Pool } from 'pg';
import type { SiemConfig } from '../contract.ts';

/** List all SIEM configurations. */
export async function listConfigs(pool: Pool): Promise<SiemConfig[]> {
  const result = await pool.query(
    `SELECT id, name, format, mode, endpoint, filters, enabled, created_at
     FROM siem_configs
     ORDER BY created_at DESC`,
  );
  return result.rows.map(mapRow);
}

/** Get a single SIEM config by ID. */
export async function getConfig(pool: Pool, id: string): Promise<SiemConfig | null> {
  const result = await pool.query(
    `SELECT id, name, format, mode, endpoint, filters, enabled, created_at
     FROM siem_configs
     WHERE id = $1`,
    [id],
  );
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

/** Create or update a SIEM config (upsert). */
export async function upsertConfig(pool: Pool, config: SiemConfig): Promise<void> {
  await pool.query(
    `INSERT INTO siem_configs (id, name, format, mode, endpoint, filters, enabled, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       format = EXCLUDED.format,
       mode = EXCLUDED.mode,
       endpoint = EXCLUDED.endpoint,
       filters = EXCLUDED.filters,
       enabled = EXCLUDED.enabled`,
    [
      config.id,
      config.name,
      config.format,
      config.mode,
      config.endpoint ?? null,
      config.filters ?? {},
      config.enabled,
      config.createdAt,
    ],
  );
}

/** Delete a SIEM config. */
export async function deleteConfig(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM siem_configs WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

function mapRow(row: Record<string, unknown>): SiemConfig {
  return {
    id: row.id as string,
    name: row.name as string,
    format: row.format as SiemConfig['format'],
    mode: row.mode as SiemConfig['mode'],
    endpoint: (row.endpoint as string) ?? undefined,
    filters: row.filters as Record<string, string> | undefined,
    enabled: row.enabled as boolean,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
  };
}
