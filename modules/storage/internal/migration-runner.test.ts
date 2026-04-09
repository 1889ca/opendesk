/** Contract: contracts/storage/rules.md */
import { it, expect, beforeEach } from 'vitest';
import { runMigrations } from './migration-runner.ts';
import { describeIntegration } from '../../../tests/integration/test-pg.ts';

// Issue #127: this test used to mock pg.Pool with a hand-built fake
// that recorded SQL strings. That tested the SHAPE of the queries
// but never the BEHAVIOR of running migrations against a real
// Postgres. Now it hits a real PG via the integration runner and
// asserts on actual schema state.

describeIntegration('runMigrations (integration)', (ctx) => {
  beforeEach(async () => {
    if (!ctx.adminPool) return;
    // Wipe the tracking table so each test runs migrations from
    // scratch. The actual schema tables are left intact (other tests
    // depend on them).
    await ctx.adminPool.query('DROP TABLE IF EXISTS schema_migrations');
  });

  it('creates the schema_migrations tracking table on first run', async () => {
    if (!ctx.adminPool) return;

    await runMigrations(ctx.adminPool);

    const { rows } = await ctx.adminPool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'schema_migrations'
       ) AS exists`,
    );
    expect(rows[0].exists).toBe(true);
  });

  it('records every applied migration in schema_migrations', async () => {
    if (!ctx.adminPool) return;

    await runMigrations(ctx.adminPool);

    const { rows } = await ctx.adminPool.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename',
    );
    const filenames = rows.map((r) => r.filename);

    // The migrations directory is checked in to the repo; the runner
    // should have applied at least the foundational ones. Asserting
    // on a known prefix is enough — we don't want to lock the test
    // to the current full set.
    expect(filenames).toContain('000_initial_schema.sql');
    expect(filenames.length).toBeGreaterThan(5);
  });

  it('is idempotent: running twice does not re-apply migrations', async () => {
    if (!ctx.adminPool) return;

    await runMigrations(ctx.adminPool);

    const { rows: firstRun } = await ctx.adminPool.query<{ filename: string; applied_at: Date }>(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename',
    );

    await runMigrations(ctx.adminPool);

    const { rows: secondRun } = await ctx.adminPool.query<{ filename: string; applied_at: Date }>(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename',
    );

    expect(secondRun.length).toBe(firstRun.length);
    // applied_at timestamps must be unchanged — proof that the second
    // run skipped the existing rows instead of re-inserting.
    for (let i = 0; i < firstRun.length; i++) {
      expect(secondRun[i].filename).toBe(firstRun[i].filename);
      expect(secondRun[i].applied_at.getTime()).toBe(firstRun[i].applied_at.getTime());
    }
  });

  it('applies migrations in sorted filename order', async () => {
    if (!ctx.adminPool) return;

    await runMigrations(ctx.adminPool);

    const { rows } = await ctx.adminPool.query<{ filename: string; id: number }>(
      'SELECT filename, id FROM schema_migrations ORDER BY id',
    );

    // schema_migrations.id is a SERIAL, so insertion order is monotonic.
    // The runner sorts files alphabetically before applying, so the
    // recorded filenames should also be sorted.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].filename > rows[i - 1].filename).toBe(true);
    }
  });

  // NOTE: the rollback-on-error path is not covered here because the
  // runner reads SQL files from the on-disk migrations/ directory and
  // there's no clean way to inject a malformed file in an integration
  // test. The previous unit test mocked pg.Pool entirely to fake an
  // exception, which is exactly the pattern issue #127 forbids. If
  // rollback regression coverage matters, the right move is to
  // refactor runMigrations to accept a SQL provider (defaulting to
  // the filesystem reader) so a test can supply a bad SQL string.
  // Tracked as a follow-up on #127.
});
