/** Contract: contracts/storage/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { searchDocuments, APPLY_SEARCH_SCHEMA } from './pg-search.ts';
import { describeIntegration } from '../../../tests/integration/test-pg.ts';

// Issue #127: this test used to mock pg.Pool with vi.fn() and assert
// on SQL string fragments. The integration version actually inserts
// documents and runs full-text queries against them.

const TEST_PREFIX = 'TestSearch_';

describeIntegration('searchDocuments (integration)', (ctx) => {
  beforeEach(async () => {
    if (!ctx.pool) return;
    // ALTER TABLE / CREATE INDEX in APPLY_SEARCH_SCHEMA require DDL
    // privileges — use the admin pool. The actual searchDocuments
    // calls below run on the unprivileged ctx.pool to exercise the
    // production code path.
    await ctx.adminPool.query(APPLY_SEARCH_SCHEMA);
    await ctx.adminPool.query(
      `DELETE FROM documents WHERE title LIKE $1`,
      [`${TEST_PREFIX}%`],
    );
  });

  it('returns matching documents with snippet, rank, and updated_at', async () => {
    if (!ctx.pool) return;

    const docId = randomUUID();
    await ctx.pool.query(
      `INSERT INTO documents (id, title, document_type, created_at, updated_at)
       VALUES ($1, $2, 'text', NOW(), NOW())`,
      [docId, `${TEST_PREFIX}Hello World Search Match`],
    );

    const results = await searchDocuments('Hello', undefined, ctx.pool);

    const ours = results.find((r) => r.id === docId);
    expect(ours).toBeDefined();
    expect(ours?.title).toBe(`${TEST_PREFIX}Hello World Search Match`);
    expect(ours?.snippet).toContain('<mark>');
    expect(typeof ours?.rank).toBe('number');
    expect(ours?.updated_at).toBeInstanceOf(Date);
  });

  it('returns an empty array when allowedDocumentIds is empty (no permission)', async () => {
    if (!ctx.pool) return;

    const docId = randomUUID();
    await ctx.pool.query(
      `INSERT INTO documents (id, title, document_type, created_at, updated_at)
       VALUES ($1, $2, 'text', NOW(), NOW())`,
      [docId, `${TEST_PREFIX}Forbidden`],
    );

    const results = await searchDocuments('Forbidden', [], ctx.pool);
    expect(results).toEqual([]);
  });

  it('filters by allowedDocumentIds when provided', async () => {
    if (!ctx.pool) return;

    const allowedId = randomUUID();
    const otherId = randomUUID();
    await ctx.pool.query(
      `INSERT INTO documents (id, title, document_type, created_at, updated_at)
       VALUES ($1, $2, 'text', NOW(), NOW()),
              ($3, $4, 'text', NOW(), NOW())`,
      [
        allowedId, `${TEST_PREFIX}Visible`,
        otherId, `${TEST_PREFIX}Visible`,
      ],
    );

    const results = await searchDocuments('Visible', [allowedId], ctx.pool);
    const ids = results.map((r) => r.id);
    expect(ids).toContain(allowedId);
    expect(ids).not.toContain(otherId);
  });

  it('returns no matches for a query with no hits', async () => {
    if (!ctx.pool) return;

    const results = await searchDocuments(
      'zzzzdefinitelynothereanywhere',
      undefined,
      ctx.pool,
    );
    // Other tests' fixtures may exist, but no document should contain
    // this nonsense token.
    expect(results.find((r) => r.title.includes('zzzzdefinitely'))).toBeUndefined();
  });
});

describe('APPLY_SEARCH_SCHEMA (static)', () => {
  it('contains the ALTER TABLE for the search_vector column', () => {
    expect(APPLY_SEARCH_SCHEMA).toContain('search_vector');
    expect(APPLY_SEARCH_SCHEMA).toContain('tsvector');
  });

  it('creates a GIN index for the search column', () => {
    expect(APPLY_SEARCH_SCHEMA).toContain('USING GIN');
    expect(APPLY_SEARCH_SCHEMA).toContain('idx_documents_search');
  });
});
