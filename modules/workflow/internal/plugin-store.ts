/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { WasmPlugin, CreateWasmPlugin } from './plugin-types.ts';

function rowToPlugin(row: Record<string, unknown>): WasmPlugin {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    inputSchema: row.input_schema as Record<string, unknown>,
    outputSchema: row.output_schema as Record<string, unknown>,
    version: row.version as string,
    builtIn: row.built_in as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function createPlugin(
  pool: Pool,
  plugin: CreateWasmPlugin,
  wasmBinary: Buffer,
): Promise<WasmPlugin> {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO wasm_plugins
       (id, name, description, wasm_binary, input_schema, output_schema, version, built_in)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id, plugin.name, plugin.description ?? '',
      wasmBinary,
      JSON.stringify(plugin.inputSchema ?? {}),
      JSON.stringify(plugin.outputSchema ?? {}),
      plugin.version ?? '1.0.0',
      plugin.builtIn ?? false,
    ],
  );
  return rowToPlugin(rows[0]);
}

export async function getPlugin(pool: Pool, id: string): Promise<WasmPlugin | null> {
  const { rows } = await pool.query(
    'SELECT * FROM wasm_plugins WHERE id = $1',
    [id],
  );
  return rows.length > 0 ? rowToPlugin(rows[0]) : null;
}

export async function getPluginBinary(pool: Pool, id: string): Promise<Buffer | null> {
  const { rows } = await pool.query(
    'SELECT wasm_binary FROM wasm_plugins WHERE id = $1',
    [id],
  );
  return rows.length > 0 ? (rows[0].wasm_binary as Buffer) : null;
}

export async function listPlugins(pool: Pool): Promise<WasmPlugin[]> {
  const { rows } = await pool.query(
    'SELECT * FROM wasm_plugins ORDER BY name ASC',
  );
  return rows.map(rowToPlugin);
}

export async function deletePlugin(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM wasm_plugins WHERE id = $1 AND built_in = false',
    [id],
  );
  return (rowCount ?? 0) > 0;
}

export async function getPluginByName(pool: Pool, name: string): Promise<WasmPlugin | null> {
  const { rows } = await pool.query(
    'SELECT * FROM wasm_plugins WHERE name = $1',
    [name],
  );
  return rows.length > 0 ? rowToPlugin(rows[0]) : null;
}
