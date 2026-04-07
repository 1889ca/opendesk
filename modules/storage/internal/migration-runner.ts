/** Contract: contracts/storage/rules.md */
import fs from 'node:fs';
import path from 'node:path';
import type pg from 'pg';

/** Walk up from a starting directory to find the project root (contains package.json). */
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

const PROJECT_ROOT = findProjectRoot(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
);
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'migrations');

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

/** Return sorted list of *.sql filenames from the migrations directory. */
function listMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** Return the set of migration filenames already applied. */
async function appliedMigrations(pool: pg.Pool): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename',
  );
  return new Set(result.rows.map((r) => r.filename));
}

/**
 * Run all pending SQL migrations inside individual transactions.
 * Safe for both fresh installs (runs everything) and existing
 * databases (skips already-applied files).
 */
export async function runMigrations(pool: pg.Pool): Promise<void> {
  await pool.query(CREATE_TRACKING_TABLE);

  const applied = await appliedMigrations(pool);
  const files = listMigrationFiles();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(
        `Migration ${file} failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      client.release();
    }
  }
}
