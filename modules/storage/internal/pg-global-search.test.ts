/** Contract: contracts/storage/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { globalSearch } from './pg-global-search.ts';
import type { Pool } from 'pg';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as unknown as Pool;

describe('globalSearch', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });
  it('returns results with content_type mapped from document_type', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'doc-1',
          title: 'Budget Report',
          document_type: 'text',
          snippet: '<mark>Budget</mark> Report',
          rank: 0.9,
          updated_at: new Date('2026-01-01'),
        },
        {
          id: 'sheet-1',
          title: 'Budget Sheet',
          document_type: 'spreadsheet',
          snippet: '<mark>Budget</mark> Sheet',
          rank: 0.7,
          updated_at: new Date('2026-01-02'),
        },
      ],
    });

    const results = await globalSearch('budget', undefined, mockPool);
    expect(results).toHaveLength(2);
    expect(results[0].content_type).toBe('document');
    expect(results[1].content_type).toBe('spreadsheet');
  });

  it('returns empty array when allowedDocumentIds is empty', async () => {
    const results = await globalSearch('test', [], mockPool);
    expect(results).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('passes allowedDocumentIds filter when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await globalSearch('test', ['id-1', 'id-2'], mockPool);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('AND id = ANY($2)'),
      ['test', ['id-1', 'id-2']],
    );
  });

  it('omits filter in dev mode (no allowedIds)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await globalSearch('test', undefined, mockPool);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.not.stringContaining('AND id = ANY'),
      ['test'],
    );
  });

  it('maps presentation document_type correctly', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'pres-1',
          title: 'Slides',
          document_type: 'presentation',
          snippet: 'Slides',
          rank: 0.5,
          updated_at: new Date(),
        },
      ],
    });

    const results = await globalSearch('slides', undefined, mockPool);
    expect(results[0].content_type).toBe('presentation');
  });
});
