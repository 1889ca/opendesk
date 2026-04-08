/** Contract: contracts/storage/rules.md */
import { pool } from './pool.ts';
import { runMigrations } from './migration-runner.ts';

/**
 * Initialize the database schema by running all pending migrations.
 * Safe to call multiple times — already-applied migrations are skipped.
 */
export async function initSchema(): Promise<void> {
  await runMigrations(pool);
}
