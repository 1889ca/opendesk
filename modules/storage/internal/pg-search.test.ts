/** Contract: contracts/storage/rules.md */
import { describe, it, expect, vi } from 'vitest';

// Stub the pool module
vi.mock('./pool.ts', () => ({
  pool: {
    query: vi.fn(async () => ({
      rows: [
        {
          id: 'abc-123',
          title: 'Test Document',
          snippet: '<mark>Test</mark> Document',
          rank: 0.75,
          updated_at: new Date('2026-01-01'),
        },
      ],
    })),
  },
}));

// Import after mock
const { searchDocuments, APPLY_SEARCH_SCHEMA } = await import('./pg-search.ts');
const { pool } = await import('./pool.ts');

describe('searchDocuments', () => {
  it('returns search results with expected fields', async () => {
    const results = await searchDocuments('test');
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'abc-123',
      title: 'Test Document',
      snippet: '<mark>Test</mark> Document',
      rank: 0.75,
      updated_at: expect.any(Date),
    });
  });

  it('calls pool.query with plainto_tsquery', async () => {
    await searchDocuments('hello world');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('plainto_tsquery'),
      ['hello world'],
    );
  });

  it('limits results to 50', async () => {
    await searchDocuments('test');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 50'),
      expect.any(Array),
    );
  });
});

describe('APPLY_SEARCH_SCHEMA', () => {
  it('contains ALTER TABLE for search_vector column', () => {
    expect(APPLY_SEARCH_SCHEMA).toContain('search_vector');
    expect(APPLY_SEARCH_SCHEMA).toContain('tsvector');
  });

  it('creates a GIN index', () => {
    expect(APPLY_SEARCH_SCHEMA).toContain('USING GIN');
    expect(APPLY_SEARCH_SCHEMA).toContain('idx_documents_search');
  });
});
