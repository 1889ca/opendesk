/**
 * Per-test-file integration helper for tests that need a real
 * Postgres connection (issue #126/#127).
 *
 * Database bootstrap (migrations + RLS role + grants) happens in
 * tests/integration/global-setup.ts, which vitest runs ONCE before
 * any worker. This file just opens pg pools that connect to the
 * already-prepared database and exposes them through the
 * describeIntegration helper.
 *
 * Two pools are exposed per test context:
 *
 * - `pool` — unprivileged "rls" pool: connects as a NOSUPERUSER /
 *   NOBYPASSRLS role so the RLS policies on grants and share_links
 *   actually take effect. Postgres superusers always bypass RLS
 *   regardless of FORCE ROW LEVEL SECURITY, which is exactly the
 *   bug RLS testing is trying to catch. Use this for production
 *   code paths under test.
 *
 * - `adminPool` — privileged pool used for fixture setup that
 *   legitimately needs to ignore RLS (e.g. seeding rows that don't
 *   belong to the current principal so the test can verify the
 *   principal can't see them) or to issue DDL.
 *
 * Env vars (defaults match docker-compose.yml):
 *
 *   OPENDESK_TEST_PG          = 1   (opt in)
 *   OPENDESK_TEST_PG_HOST     = localhost
 *   OPENDESK_TEST_PG_PORT     = 5433
 *   OPENDESK_TEST_PG_DATABASE = opendesk
 *   OPENDESK_TEST_PG_USER     = opendesk
 *   OPENDESK_TEST_PG_PASSWORD = opendesk_dev
 */

import pg from 'pg';
import { describe, beforeAll, afterAll } from 'vitest';

export type IntegrationContext = {
  pool: pg.Pool;
  adminPool: pg.Pool;
};

const RLS_ROLE = 'opendesk_rls';
const RLS_PASSWORD = 'opendesk_rls_test';

let cachedAdminPool: pg.Pool | null = null;
let cachedRlsPool: pg.Pool | null = null;

function buildAdminConfig(): pg.PoolConfig {
  return {
    host: process.env.OPENDESK_TEST_PG_HOST ?? 'localhost',
    port: Number(process.env.OPENDESK_TEST_PG_PORT ?? 5433),
    database: process.env.OPENDESK_TEST_PG_DATABASE ?? 'opendesk',
    user: process.env.OPENDESK_TEST_PG_USER ?? 'opendesk',
    password: process.env.OPENDESK_TEST_PG_PASSWORD ?? 'opendesk_dev',
    max: 4,
    connectionTimeoutMillis: 2000,
  };
}

function buildRlsConfig(): pg.PoolConfig {
  return {
    ...buildAdminConfig(),
    user: RLS_ROLE,
    password: RLS_PASSWORD,
  };
}

function getAdminPool(): pg.Pool {
  if (!cachedAdminPool) {
    cachedAdminPool = new pg.Pool(buildAdminConfig());
  }
  return cachedAdminPool;
}

function getRlsPool(): pg.Pool {
  if (!cachedRlsPool) {
    cachedRlsPool = new pg.Pool(buildRlsConfig());
  }
  return cachedRlsPool;
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
 * the unprivileged RLS pool plus an admin pool for fixture seeding.
 * The database itself is provisioned by global-setup.ts before any
 * worker starts, so this just opens connections.
 */
export function describeIntegration(
  name: string,
  fn: (ctx: IntegrationContext) => void,
): void {
  describe.skipIf(!INTEGRATION_OPT_IN)(name, () => {
    const ctx: IntegrationContext = {
      pool: null as unknown as pg.Pool,
      adminPool: null as unknown as pg.Pool,
    };

    beforeAll(() => {
      ctx.adminPool = getAdminPool();
      ctx.pool = getRlsPool();
    });

    afterAll(async () => {
      // Pools are shared across suites in the same worker; don't
      // close them here. The vitest worker exit drops them.
    });

    fn(ctx);
  });
}

/** Close cached pools. Call from a global teardown if needed. */
export async function closeTestPool(): Promise<void> {
  if (cachedRlsPool) {
    await cachedRlsPool.end();
    cachedRlsPool = null;
  }
  if (cachedAdminPool) {
    await cachedAdminPool.end();
    cachedAdminPool = null;
  }
}
