/** Contract: contracts/storage/rules.md */
import { describe, it, expect } from 'vitest';
import { runMigrations } from './migration-runner.ts';
import type pg from 'pg';

/**
 * Build a fake pg.Pool that records all queries and returns canned results.
 * The applied set simulates which migrations have already run.
 */
function createFakePool(alreadyApplied: string[] = []) {
  const queries: { sql: string; params?: unknown[] }[] = [];
  const committed = false;
  const rolledBack = false;

  const fakeClient = {
    query: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      // Return applied migrations when asked
      if (sql.includes('SELECT filename FROM schema_migrations')) {
        return {
          rows: alreadyApplied.map((f) => ({ filename: f })),
        };
      }
      return { rows: [], rowCount: 0 };
    },
    connect: async () => fakeClient,
    queries,
    get committed() { return committed; },
    get rolledBack() { return rolledBack; },
  };

  return pool;
}

describe('runMigrations', () => {
  it('creates the schema_migrations tracking table', async () => {
    const pool = createFakePool();
    await runMigrations(pool as unknown as pg.Pool);

    const createTableQuery = pool.queries.find((q) =>
      q.sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations'),
    );
    expect(createTableQuery).toBeDefined();
  });

  it('queries for already-applied migrations', async () => {
    const pool = createFakePool();
    await runMigrations(pool as unknown as pg.Pool);

    const selectQuery = pool.queries.find((q) =>
      q.sql.includes('SELECT filename FROM schema_migrations'),
    );
    expect(selectQuery).toBeDefined();
  });

  it('runs pending migrations with BEGIN/COMMIT', async () => {
    const pool = createFakePool();
    await runMigrations(pool as unknown as pg.Pool);

    // Should have at least one BEGIN and COMMIT pair (for the first migration)
    const begins = pool.queries.filter((q) => q.sql === 'BEGIN');
    const commits = pool.queries.filter((q) => q.sql === 'COMMIT');
    expect(begins.length).toBeGreaterThan(0);
    expect(commits.length).toBe(begins.length);
  });

  it('inserts migration filename into tracking table', async () => {
    const pool = createFakePool();
    await runMigrations(pool as unknown as pg.Pool);

    const insertQueries = pool.queries.filter((q) =>
      q.sql.includes('INSERT INTO schema_migrations'),
    );
    expect(insertQueries.length).toBeGreaterThan(0);
    // First migration file should be 000_initial_schema.sql
    expect(insertQueries[0].params).toEqual(['000_initial_schema.sql']);
  });

  it('skips already-applied migrations', async () => {
    const pool = createFakePool([
      '000_initial_schema.sql',
      '001_add_document_type.sql',
    ]);
    await runMigrations(pool as unknown as pg.Pool);

    const insertQueries = pool.queries.filter((q) =>
      q.sql.includes('INSERT INTO schema_migrations'),
    );
    // Should not re-insert the two already-applied files
    const insertedFiles = insertQueries.map((q) => q.params?.[0]);
    expect(insertedFiles).not.toContain('000_initial_schema.sql');
    expect(insertedFiles).not.toContain('001_add_document_type.sql');
  });

  it('applies migrations in sorted filename order', async () => {
    const pool = createFakePool();
    await runMigrations(pool as unknown as pg.Pool);

    const insertQueries = pool.queries.filter((q) =>
      q.sql.includes('INSERT INTO schema_migrations'),
    );
    const filenames = insertQueries.map((q) => q.params?.[0] as string);

    // Verify sorted order
    for (let i = 1; i < filenames.length; i++) {
      expect(filenames[i] > filenames[i - 1]).toBe(true);
    }
  });

  it('rolls back on query failure', async () => {
    const queries: string[] = [];
    let failOnSql = false;

    const fakeClient = {
      query: async (sql: string) => {
        queries.push(sql);
        if (failOnSql && sql !== 'BEGIN' && sql !== 'ROLLBACK') {
          failOnSql = false;
          throw new Error('syntax error in migration');
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    };

    const pool = {
      query: async (sql: string) => {
        if (sql.includes('SELECT filename FROM schema_migrations')) {
          return { rows: [] };
        }
        return { rows: [], rowCount: 0 };
      },
      connect: async () => {
        failOnSql = true;
        return fakeClient;
      },
    };

    await expect(
      runMigrations(pool as unknown as pg.Pool),
    ).rejects.toThrow('Migration 000_initial_schema.sql failed');

    expect(queries).toContain('ROLLBACK');
  });
});
