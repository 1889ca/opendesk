/** Contract: contracts/storage/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { globalSearch } from './pg-global-search.ts';
import { APPLY_SEARCH_SCHEMA } from './pg-search.ts';
import { describeIntegration } from '../../../tests/integration/test-pg.ts';

// Issue #127: this test used to mock pg.Pool with vi.fn(). The
// integration version inserts documents of each type and verifies
// the content_type mapping against real query results.

const TEST_PREFIX = 'TestGlobalSearch_';

async function insert(
  pool: import('pg').Pool,
  id: string,
  title: string,
  documentType: 'text' | 'spreadsheet' | 'presentation',
): Promise<void> {
  await pool.query(
    `INSERT INTO documents (id, title, document_type, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [id, title, documentType],
  );
}

describeIntegration('globalSearch (integration)', (ctx) => {
  beforeEach(async () => {
    if (!ctx.pool) return;
    // ALTER TABLE / CREATE INDEX in APPLY_SEARCH_SCHEMA require DDL
    // privileges — use the admin pool. The actual globalSearch calls
    // run on the unprivileged ctx.pool.
    await ctx.adminPool.query(APPLY_SEARCH_SCHEMA);
    await ctx.adminPool.query(
      `DELETE FROM documents WHERE title LIKE $1`,
      [`${TEST_PREFIX}%`],
    );
  });

  it('returns empty array when allowedDocumentIds is empty', async () => {
    if (!ctx.pool) return;
    const results = await globalSearch('anything', [], ctx.pool);
    expect(results).toEqual([]);
  });

  it('maps text document_type to content_type "document"', async () => {
    if (!ctx.pool) return;
    const id = randomUUID();
    await insert(ctx.pool, id, `${TEST_PREFIX}TextDoc`, 'text');

    const results = await globalSearch('TextDoc', undefined, ctx.pool);
    const ours = results.find((r) => r.id === id);
    expect(ours).toBeDefined();
    expect(ours?.content_type).toBe('document');
  });

  it('maps spreadsheet document_type to content_type "spreadsheet"', async () => {
    if (!ctx.pool) return;
    const id = randomUUID();
    await insert(ctx.pool, id, `${TEST_PREFIX}SheetDoc`, 'spreadsheet');

    const results = await globalSearch('SheetDoc', undefined, ctx.pool);
    const ours = results.find((r) => r.id === id);
    expect(ours).toBeDefined();
    expect(ours?.content_type).toBe('spreadsheet');
  });

  it('maps presentation document_type to content_type "presentation"', async () => {
    if (!ctx.pool) return;
    const id = randomUUID();
    await insert(ctx.pool, id, `${TEST_PREFIX}SlideDoc`, 'presentation');

    const results = await globalSearch('SlideDoc', undefined, ctx.pool);
    const ours = results.find((r) => r.id === id);
    expect(ours).toBeDefined();
    expect(ours?.content_type).toBe('presentation');
  });

  it('filters results by allowedDocumentIds when provided', async () => {
    if (!ctx.pool) return;
    const allowedId = randomUUID();
    const otherId = randomUUID();
    await insert(ctx.pool, allowedId, `${TEST_PREFIX}FilterMe`, 'text');
    await insert(ctx.pool, otherId, `${TEST_PREFIX}FilterMe`, 'text');

    const results = await globalSearch('FilterMe', [allowedId], ctx.pool);
    const ids = results.map((r) => r.id);
    expect(ids).toContain(allowedId);
    expect(ids).not.toContain(otherId);
  });
});
