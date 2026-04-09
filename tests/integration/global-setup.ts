/**
 * Vitest global setup for integration tests (issue #126/#127).
 *
 * Runs ONCE per test run, before any worker starts. This is the only
 * place we run migrations, create the unprivileged RLS role, and
 * apply grants — doing it inside per-worker beforeAll hooks races
 * because vitest runs test files in parallel processes and the
 * advisory lock approach can't serialize ALTER DEFAULT PRIVILEGES.
 *
 * Each individual test file then opens its own pool against the
 * already-prepared database. See tests/integration/test-pg.ts.
 */

import pg from 'pg';
import { runMigrations } from '../../modules/storage/internal/migration-runner.ts';

const RLS_ROLE = 'opendesk_rls';
const RLS_PASSWORD = 'opendesk_rls_test';

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

export async function setup(): Promise<void> {
  // Skip entirely when integration tests aren't opted in.
  if (process.env.OPENDESK_TEST_PG !== '1') return;

  const admin = new pg.Pool(buildAdminConfig());

  try {
    await admin.query('SELECT 1');
  } catch (err) {
    await admin.end().catch(() => undefined);
    throw new Error(
      `[global-setup] cannot reach test Postgres: ${(err as Error).message}. ` +
      'Start docker-compose or set OPENDESK_TEST_PG_*.',
    );
  }

  try {
    await runMigrations(admin);

    // Create the unprivileged RLS role. Idempotent — wraps the create
    // in a DO block and catches the duplicate-role race defensively.
    try {
      await admin.query(`
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
      const code = (err as { code?: string })?.code;
      if (code !== '42710' && code !== '23505') throw err;
    }

    // Grants are idempotent — re-running them is a no-op.
    await admin.query(`
      GRANT USAGE ON SCHEMA public TO ${RLS_ROLE};
      GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public TO ${RLS_ROLE};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RLS_ROLE};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO ${RLS_ROLE};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO ${RLS_ROLE};
    `);
  } finally {
    await admin.end();
  }
}

export async function teardown(): Promise<void> {
  // Nothing to tear down — the docker-compose / CI service container
  // is the lifecycle for the database, and the test data lives
  // alongside production data on the same instance.
}
