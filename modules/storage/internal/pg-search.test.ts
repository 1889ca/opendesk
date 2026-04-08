/** Contract: contracts/storage/rules.md */
import { describe, it, expect, vi } from 'vitest';
import { searchDocuments, APPLY_SEARCH_SCHEMA } from './pg-search.ts';
import type { Pool } from 'pg';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as unknown as Pool;

describe('searchDocuments', () => {
  it('returns search results with expected fields', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'abc-123',
          title: 'Test Document',
          snippet: '<mark>Test</mark> Document',
          rank: 0.75,
          updated_at: new Date('2026-01-01'),
        },
      ],
    });

    const results = await searchDocuments('test', undefined, mockPool);
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
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await searchDocuments('hello world', undefined, mockPool);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('plainto_tsquery'),
      ['hello world'],
    );
  });

  it('limits results to 50', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await searchDocuments('test', undefined, mockPool);
    expect(mockQuery).toHaveBeenCalledWith(
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
