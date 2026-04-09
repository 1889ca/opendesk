/**
 * Integration test infrastructure for tests that need a real
 * Postgres connection (issue #127). Loads connection settings from
 * env vars, runs the project's migrations into the test database,
 * and exposes helpers to truncate tables between suites so each test
 * starts from a known state.
 *
 * Env vars (with defaults that match docker-compose.yml):
 *
 *   OPENDESK_TEST_PG_HOST     = localhost
 *   OPENDESK_TEST_PG_PORT     = 5433
 *   OPENDESK_TEST_PG_DATABASE = opendesk
 *   OPENDESK_TEST_PG_USER     = opendesk
 *   OPENDESK_TEST_PG_PASSWORD = opendesk_dev
 *
 * Tests opt in to the integration runner via:
 *
 *   import { describeIntegration } from '../../../tests/integration/test-pg.ts';
 *   describeIntegration('my suite', ({ pool }) => { ... });
 *
 * The describeIntegration helper auto-skips when no PG is reachable
 * (CI without a postgres service, dev machines without docker), so
 * the integration tests don't fail the suite when the dependency is
 * absent. CI runs them by setting up a postgres service container
 * (see .github/workflows/ci.yml).
 */

import pg from 'pg';
import { describe, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../../modules/storage/internal/migration-runner.ts';

export type IntegrationContext = {
  pool: pg.Pool;
};

let cachedPool: pg.Pool | null = null;
let connectionAttempted = false;
let connectionAvailable = false;

function buildConfig(): pg.PoolConfig {
  return {
    host: process.env.OPENDESK_TEST_PG_HOST ?? 'localhost',
    port: Number(process.env.OPENDESK_TEST_PG_PORT ?? 5433),
    database: process.env.OPENDESK_TEST_PG_DATABASE ?? 'opendesk',
    user: process.env.OPENDESK_TEST_PG_USER ?? 'opendesk',
    password: process.env.OPENDESK_TEST_PG_PASSWORD ?? 'opendesk_dev',
    max: 4,
    // Fail fast in tests — don't sit on a connection that won't open.
    connectionTimeoutMillis: 2000,
  };
}

/**
 * Probe the configured Postgres. Returns true if a connection can be
 * established, false otherwise. Caches the result so the probe only
 * runs once per test process.
 */
async function probeConnection(): Promise<boolean> {
  if (connectionAttempted) return connectionAvailable;
  connectionAttempted = true;

  const probe = new pg.Pool(buildConfig());
  try {
    await probe.query('SELECT 1');
    connectionAvailable = true;
  } catch {
    connectionAvailable = false;
  } finally {
    await probe.end().catch(() => undefined);
  }
  return connectionAvailable;
}

/**
 * Get a (lazily-created, schema-initialized) pool for integration
 * tests. Throws if no PG is reachable — call probeConnection first
 * if you need a soft check.
 */
export async function getTestPool(): Promise<pg.Pool> {
  if (cachedPool) return cachedPool;

  const ok = await probeConnection();
  if (!ok) {
    throw new Error(
      'No test Postgres reachable. Start docker-compose or set OPENDESK_TEST_PG_*.',
    );
  }

  cachedPool = new pg.Pool(buildConfig());
  await runMigrations(cachedPool);
  return cachedPool;
}

/**
 * Truncate the tables a test cares about so each suite starts clean.
 * RESTART IDENTITY resets sequences; CASCADE drops dependent rows.
 */
export async function truncate(pool: pg.Pool, ...tables: string[]): Promise<void> {
  if (tables.length === 0) return;
  await pool.query(
    `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Integration suites are opt-in. Devs and CI set OPENDESK_TEST_PG=1
 * to run them; everywhere else (`npm test` on a laptop without
 * docker, etc.), they skip cleanly via vitest's describe.skipIf.
 */
const INTEGRATION_OPT_IN = process.env.OPENDESK_TEST_PG === '1';

/**
 * describe() wrapper that runs only when OPENDESK_TEST_PG=1. Provides
 * a fresh, schema-initialized pool to the inner suite.
 */
export function describeIntegration(
  name: string,
  fn: (ctx: IntegrationContext) => void,
): void {
  describe.skipIf(!INTEGRATION_OPT_IN)(name, () => {
    const ctx: IntegrationContext = { pool: null as unknown as pg.Pool };

    beforeAll(async () => {
      ctx.pool = await getTestPool();
    });

    afterAll(async () => {
      // Pool is shared across suites; don't close it here.
    });

    fn(ctx);
  });
}

/** Close the cached pool. Call from a global teardown if needed. */
export async function closeTestPool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
}
