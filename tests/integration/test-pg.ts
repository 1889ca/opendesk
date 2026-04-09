/**
 * Integration test infrastructure for tests that need a real
 * Postgres connection (issue #127). Loads connection settings from
 * env vars, runs the project's migrations into the test database,
 * and exposes helpers to truncate tables between suites so each test
 * starts from a known state.
 *
 * Two pools are exposed:
 *
 * - `pool` (the unprivileged "rls" pool): connects as a NOSUPERUSER
 *   role so the RLS policies on grants and share_links actually
 *   take effect. Postgres superusers always bypass RLS regardless of
 *   FORCE ROW LEVEL SECURITY, which is exactly the bug RLS testing
 *   is trying to catch. Use this pool for everything by default.
 *
 * - `adminPool`: connects as the migration user (superuser by default
 *   on the docker-compose / CI postgres image). Use this for fixture
 *   setup that legitimately needs to ignore RLS — e.g. seeding rows
 *   that don't belong to the current principal so the test can verify
 *   the principal can't see them.
 *
 * Env vars (defaults match docker-compose.yml):
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
 *   describeIntegration('my suite', ({ pool, adminPool }) => { ... });
 *
 * The describeIntegration helper auto-skips when OPENDESK_TEST_PG=1
 * is not set, so dev machines without docker can still run
 * `npm test` cleanly. CI runs them by setting up a postgres service
 * container — see .github/workflows/ci.yml.
 */

import pg from 'pg';
import { describe, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../../modules/storage/internal/migration-runner.ts';

export type IntegrationContext = {
  /**
   * Unprivileged pool for test queries — connects as a NOSUPERUSER /
   * NOBYPASSRLS role so the RLS policies actually apply. Use this
   * for everything by default.
   */
  pool: pg.Pool;
  /**
   * Privileged pool for fixture setup that legitimately needs to
   * ignore RLS (e.g. seeding rows that don't belong to the current
   * principal). Avoid leaking this into production code paths under
   * test.
   */
  adminPool: pg.Pool;
};

const RLS_ROLE = 'opendesk_rls';
const RLS_PASSWORD = 'opendesk_rls_test';

let cachedAdminPool: pg.Pool | null = null;
let cachedRlsPool: pg.Pool | null = null;
let initialized = false;
let initAttempted = false;
let initSucceeded = false;

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

/**
 * Ensure an unprivileged role exists with the right grants on the
 * RLS-protected tables. Idempotent.
 *
 * Race-safety: must be called inside the advisory lock held by
 * initPools. Vitest runs test files in parallel workers, and each
 * worker tries to bootstrap the same role / schema, so naked
 * IF NOT EXISTS checks race against each other.
 */
async function ensureRlsRole(adminPool: pg.Pool): Promise<void> {
  try {
    await adminPool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_ROLE}') THEN
          CREATE ROLE ${RLS_ROLE}
            LOGIN
            PASSWORD '${RLS_PASSWORD}'
            NOSUPERUSER
            NOBYPASSRLS
            NOINHERIT;
        END IF;
      END $$;
    `);
  } catch (err) {
    // Defensive: catch the duplicate-role race in case the advisory
    // lock somehow fails to serialize. SQLSTATE 42710 = duplicate
    // object, 23505 = unique violation.
    const code = (err as { code?: string })?.code;
    if (code !== '42710' && code !== '23505') throw err;
  }

  // Grant the role enough permission to exercise the production
  // code paths the tests cover. We deliberately do NOT grant
  // ownership — RLS should still apply. TRUNCATE is included so
  // per-test cleanup works without an extra admin trip;
  // DROP / CREATE remain owner-only and use the adminPool when
  // needed. The grants themselves are idempotent.
  await adminPool.query(`
    GRANT USAGE ON SCHEMA public TO ${RLS_ROLE};
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public TO ${RLS_ROLE};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RLS_ROLE};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO ${RLS_ROLE};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO ${RLS_ROLE};
  `);
}

/**
 * Initialize both pools, run migrations, and provision the RLS role.
 * Cached after the first successful run.
 */
async function initPools(): Promise<void> {
  if (initialized) return;
  if (initAttempted) {
    // Already tried and failed — re-throw a synthetic error so the
    // calling beforeAll bails out clearly.
    throw new Error('test-pg init previously failed; check earlier logs.');
  }
  initAttempted = true;

  const admin = new pg.Pool(buildAdminConfig());
  try {
    await admin.query('SELECT 1');
  } catch (err) {
    await admin.end().catch(() => undefined);
    throw new Error(
      `Cannot reach test Postgres: ${(err as Error).message}. ` +
      'Start docker-compose or set OPENDESK_TEST_PG_*.',
    );
  }

  // Vitest runs test files in parallel workers, so multiple processes
  // race to bootstrap the same database. Hold a Postgres advisory
  // lock for the entire setup so only one worker runs migrations and
  // role creation; the others wait, then no-op past the idempotency
  // checks. 419442 is an arbitrary application-specific lock id.
  // The lock is held on a single connection from the pool — we use
  // .connect() so the lock is tied to that client and reliably
  // released when we release it.
  const lockClient = await admin.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock(419442)');
    try {
      await runMigrations(admin);
      await ensureRlsRole(admin);
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock(419442)');
    }
  } finally {
    lockClient.release();
  }

  const rls = new pg.Pool(buildRlsConfig());
  try {
    await rls.query('SELECT 1');
  } catch (err) {
    await admin.end().catch(() => undefined);
    await rls.end().catch(() => undefined);
    throw new Error(
      `Cannot connect as RLS test role '${RLS_ROLE}': ${(err as Error).message}`,
    );
  }

  cachedAdminPool = admin;
  cachedRlsPool = rls;
  initialized = true;
  initSucceeded = true;
}

/**
 * Truncate the tables a test cares about so each suite starts clean.
 * RESTART IDENTITY resets sequences; CASCADE drops dependent rows.
 * Always uses the admin pool so RLS doesn't filter the truncate.
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

    beforeAll(async () => {
      await initPools();
      ctx.pool = cachedRlsPool!;
      ctx.adminPool = cachedAdminPool!;
    });

    afterAll(async () => {
      // Pools are shared across suites; don't close them here.
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
  initialized = false;
  initAttempted = false;
  initSucceeded = false;
}
