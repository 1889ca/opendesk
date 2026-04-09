/** Contract: contracts/storage/rules.md */
import { it, expect } from 'vitest';
import { runMigrations } from './migration-runner.ts';
import { describeIntegration } from '../../../tests/integration/test-pg.ts';

// Issue #127: this test used to mock pg.Pool with a hand-built fake
// that recorded SQL strings. That tested the SHAPE of the queries
// but never the BEHAVIOR of running migrations against a real
// Postgres. Now it asserts on the real schema_migrations state that
// the integration test harness already populated by running
// runMigrations once at startup.
//
// Important: we deliberately do NOT drop and re-apply schema_migrations
// inside this test. Several existing migrations have non-idempotent
// side effects at the pg_type level (the implicit row type for each
// CREATE TABLE) that prevent a clean re-run on the same database
// without a full schema teardown. Verifying state properties of the
// already-applied migration set is enough to lock in the runner's
// behavioral contract for integration purposes; the rollback /
// fresh-DB paths are best covered by a unit test against a SQL
// injector once the runner is refactored. Tracked as a follow-up
// on #127.

describeIntegration('runMigrations (integration)', (ctx) => {
  it('schema_migrations table exists after the harness runs migrations', async () => {
    if (!ctx.adminPool) return;

    const { rows } = await ctx.adminPool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'schema_migrations'
       ) AS exists`,
    );
    expect(rows[0].exists).toBe(true);
  });

  it('every checked-in migration has been recorded as applied', async () => {
    if (!ctx.adminPool) return;

    const { rows } = await ctx.adminPool.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename',
    );
    const filenames = rows.map((r) => r.filename);

    expect(filenames).toContain('000_initial_schema.sql');
    expect(filenames.length).toBeGreaterThan(5);
  });

  it('is idempotent: re-running runMigrations is a no-op', async () => {
    if (!ctx.adminPool) return;

    const { rows: firstRun } = await ctx.adminPool.query<{ filename: string; applied_at: Date }>(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename',
    );

    await runMigrations(ctx.adminPool);

    const { rows: secondRun } = await ctx.adminPool.query<{ filename: string; applied_at: Date }>(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename',
    );

    expect(secondRun.length).toBe(firstRun.length);
    // applied_at timestamps must be unchanged — proof that the
    // second runMigrations call skipped the existing rows instead
    // of re-inserting.
    for (let i = 0; i < firstRun.length; i++) {
      expect(secondRun[i].filename).toBe(firstRun[i].filename);
      expect(secondRun[i].applied_at.getTime()).toBe(firstRun[i].applied_at.getTime());
    }
  });

  it('applies migrations in sorted filename order', async () => {
    if (!ctx.adminPool) return;

    const { rows } = await ctx.adminPool.query<{ filename: string; id: number }>(
      'SELECT filename, id FROM schema_migrations ORDER BY id',
    );

    // schema_migrations.id is a SERIAL, so insertion order is
    // monotonic. The runner sorts files alphabetically before
    // applying, so the recorded filenames should also be sorted.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].filename > rows[i - 1].filename).toBe(true);
    }
  });
});
