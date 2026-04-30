/** Contract: contracts/storage/rules.md */
import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { describeIntegration } from '../../../tests/integration/test-pg.ts';
import { createDocumentRepository } from './pg-document-repository.ts';
import { runWithPrincipal, runAsSystem } from './principal-context.ts';
import { initPool } from './pool.ts';

/**
 * RLS enforcement on the cold-tier read path (issue #510).
 *
 * Verifies that `getSnapshot` routes through `rlsQuery` so the
 * Postgres RLS policies on `documents` filter rows by the caller's
 * principal. A non-grant-holder must not be able to read any document
 * even if they know the document ID (IDOR prevention).
 *
 * Two pools in play:
 * - ctx.adminPool — superuser, bypasses RLS, used to seed fixtures
 * - ctx.pool (opendesk_rls role, NOBYPASSRLS) — wired into initPool
 *   so that the module-level `pool` singleton uses the constrained role.
 *   This ensures production code paths execute under the same constraints
 *   as real RLS-enforced requests.
 */
describeIntegration('cold-tier read path enforces RLS (#510)', (ctx) => {
  const ownerPrincipal = `owner-${randomUUID()}`;
  const intruderPrincipal = `intruder-${randomUUID()}`;

  beforeAll(() => {
    // Wire the global pool singleton to the NOBYPASSRLS role so that
    // rlsQuery calls in the production code path are constrained by RLS.
    initPool({
      host: process.env.OPENDESK_TEST_PG_HOST ?? 'localhost',
      port: Number(process.env.OPENDESK_TEST_PG_PORT ?? 5433),
      database: process.env.OPENDESK_TEST_PG_DATABASE ?? 'opendesk',
      user: 'opendesk_rls',
      password: 'opendesk_rls_test',
      maxConnections: 4,
    });
  });

  describe('getSnapshot: principal context required', () => {
    it('throws when called outside any principal context', async () => {
      const docId = randomUUID();
      await ctx.adminPool.query(
        `INSERT INTO documents (id, title, snapshot, revision_id, tier, document_type, created_at, updated_at)
         VALUES ($1, 'ctx-less', $2::jsonb, 'rev-x', 'hot', 'text', NOW(), NOW())`,
        [docId, JSON.stringify({ type: 'doc', content: [] })],
      );

      const repo = createDocumentRepository();
      // No runWithPrincipal / runAsSystem wrapper — rlsQuery must throw.
      await expect(repo.getSnapshot(docId)).rejects.toThrow(
        /rlsQuery called outside any principal context/,
      );
    });
  });

  describe('getSnapshot: non-grant-holder cannot read a cold-tier document', () => {
    it('returns null for a document the intruder has no grant on', async () => {
      // Seed a hot-tier document via adminPool (bypasses RLS).
      const docId = randomUUID();
      const snapshot = { type: 'doc', content: [{ text: 'secret' }] };
      await ctx.adminPool.query(
        `INSERT INTO documents (id, title, snapshot, revision_id, tier, document_type, created_at, updated_at)
         VALUES ($1, 'private-doc', $2::jsonb, 'rev-1', 'hot', 'text', NOW(), NOW())`,
        [docId, JSON.stringify(snapshot)],
      );

      // The intruder has no grants on this document.
      // RLS on the opendesk_rls role enforces isolation — the SELECT
      // inside rlsQuery must return zero rows.
      const repo = createDocumentRepository();
      const result = await runWithPrincipal(intruderPrincipal, () =>
        repo.getSnapshot(docId),
      );

      expect(result).toBeNull();
    });

    it('returns null for a non-existent document regardless of principal', async () => {
      const repo = createDocumentRepository();
      const result = await runWithPrincipal(intruderPrincipal, () =>
        repo.getSnapshot(randomUUID()),
      );
      expect(result).toBeNull();
    });
  });

  describe('getSnapshot: system principal bypasses RLS', () => {
    it('returns a document when called with runAsSystem', async () => {
      const docId = randomUUID();
      const snapshot = { type: 'doc', content: [{ text: 'system-visible' }] };
      await ctx.adminPool.query(
        `INSERT INTO documents (id, title, snapshot, revision_id, tier, document_type, created_at, updated_at)
         VALUES ($1, 'sys-doc', $2::jsonb, 'rev-sys', 'hot', 'text', NOW(), NOW())`,
        [docId, JSON.stringify(snapshot)],
      );

      const repo = createDocumentRepository();
      const result = await runAsSystem(() => repo.getSnapshot(docId));

      // __system__ is whitelisted by the RLS policy — doc must be returned.
      expect(result).not.toBeNull();
      expect(result?.revisionId).toBe('rev-sys');
    });
  });
});

// Static (non-database) checks that the import chain resolves.
describe('cold-storage RLS: static import checks', () => {
  it('createDocumentRepository is exported from pg-document-repository', async () => {
    const mod = await import('./pg-document-repository.ts');
    expect(typeof mod.createDocumentRepository).toBe('function');
  });

  it('createColdStorageAdapter is exported from cold-storage', async () => {
    const mod = await import('./cold-storage.ts');
    expect(typeof mod.createColdStorageAdapter).toBe('function');
  });
});
