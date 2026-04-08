/** Contract: contracts/ai/rules.md */
import { describe, it, expect } from 'vitest';
import {
  kbReferenceExtractor,
  kbEntityExtractor,
  kbDatasetExtractor,
  kbNoteExtractor,
  kbGlossaryExtractor,
} from './kb-extractors.ts';
import type { KbEntry } from '../../kb/contract.ts';

const baseEntry: Omit<KbEntry, 'entryType' | 'content'> = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  workspaceId: '550e8400-e29b-41d4-a716-446655440001',
  corpus: 'knowledge',
  lifecycle: 'published',
  title: 'Test Entry',
  tags: [],
  createdBy: 'user-1',
  createdAt: '2026-04-08T00:00:00Z',
  updatedAt: '2026-04-08T00:00:00Z',
};

describe('kbReferenceExtractor', () => {
  it('extracts title + authors + abstract', () => {
    const entry: KbEntry = {
      ...baseEntry,
      entryType: 'reference',
      content: {
        authors: [
          { given: 'Jane', family: 'Doe' },
          { literal: 'ACME Research Group' },
        ],
        abstract: 'This paper explores CRDT applications.',
        metadata: {},
      },
    };

    const result = kbReferenceExtractor(entry);
    expect(result).toContain('Test Entry');
    expect(result).toContain('Jane Doe');
    expect(result).toContain('ACME Research Group');
    expect(result).toContain('This paper explores CRDT applications.');
  });

  it('handles missing abstract', () => {
    const entry: KbEntry = {
      ...baseEntry,
      entryType: 'reference',
      content: { authors: [], abstract: null, metadata: {} },
    };

    const result = kbReferenceExtractor(entry);
    expect(result).toContain('Test Entry');
    expect(result).not.toContain('null');
  });
});

describe('kbEntityExtractor', () => {
  it('extracts name + description + metadata', () => {
    const entry: KbEntry = {
      ...baseEntry,
      title: 'OpenDesk',
      entryType: 'entity',
      content: {
        description: 'A sovereign office suite',
        metadata: { type: 'software', license: 'AGPL-3.0' },
      },
    };

    const result = kbEntityExtractor(entry);
    expect(result).toContain('OpenDesk');
    expect(result).toContain('A sovereign office suite');
    expect(result).toContain('type: software');
    expect(result).toContain('license: AGPL-3.0');
  });
});

describe('kbDatasetExtractor', () => {
  it('extracts description + columns + summary', () => {
    const entry: KbEntry = {
      ...baseEntry,
      entryType: 'dataset',
      content: {
        description: 'Quarterly revenue data',
        columns: [
          { name: 'quarter', dataType: 'string', description: 'Fiscal quarter' },
          { name: 'revenue', dataType: 'number' },
        ],
        summary: '4 quarters, total $10M',
      },
    };

    const result = kbDatasetExtractor(entry);
    expect(result).toContain('Quarterly revenue data');
    expect(result).toContain('quarter (string): Fiscal quarter');
    expect(result).toContain('revenue (number)');
    expect(result).toContain('Summary: 4 quarters, total $10M');
  });
});

describe('kbNoteExtractor', () => {
  it('extracts full text content', () => {
    const entry: KbEntry = {
      ...baseEntry,
      entryType: 'note',
      content: { content: 'Meeting notes from today. Discussed CRDT architecture.' },
    };

    const result = kbNoteExtractor(entry);
    expect(result).toContain('Test Entry');
    expect(result).toContain('Meeting notes from today');
  });
});

describe('kbGlossaryExtractor', () => {
  it('extracts term + definition', () => {
    const entry: KbEntry = {
      ...baseEntry,
      entryType: 'glossary',
      content: { term: 'CRDT', definition: 'Conflict-free Replicated Data Type' },
    };

    const result = kbGlossaryExtractor(entry);
    expect(result).toBe('CRDT: Conflict-free Replicated Data Type');
  });
});
