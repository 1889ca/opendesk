/** Contract: contracts/kb/rules.md — Reference adapter tests */
import { describe, it, expect } from 'vitest';
import { type LegacyReference, referenceToEntry, entryToReference } from './reference-adapter.ts';
import type { KBEntry } from './types.ts';

const now = new Date('2025-01-15T10:00:00Z');

function makeLegacyReference(): LegacyReference {
  return {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    workspaceId: 'w1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    doi: '10.1000/test',
    title: 'Test Reference',
    authors: ['Alice', 'Bob'],
    journal: 'Test Journal',
    year: 2024,
    volume: '1',
    issue: '2',
    pages: '10-20',
    abstract: 'Test abstract',
    url: 'https://example.com',
    publisher: 'Test Publisher',
    tags: ['physics', 'ai'],
    createdBy: 'user-1',
    createdAt: now,
    updatedAt: now,
  };
}

describe('referenceToEntry', () => {
  it('converts legacy reference to KB entry', () => {
    const ref = makeLegacyReference();
    const entry = referenceToEntry(ref);

    expect(entry.id).toBe(ref.id);
    expect(entry.workspaceId).toBe(ref.workspaceId);
    expect(entry.entryType).toBe('reference');
    expect(entry.title).toBe(ref.title);
    expect(entry.version).toBe(1);
    expect(entry.tags).toEqual(ref.tags);
    expect(entry.metadata).toMatchObject({
      doi: '10.1000/test',
      authors: ['Alice', 'Bob'],
      journal: 'Test Journal',
      year: 2024,
    });
  });

  it('handles minimal reference', () => {
    const ref: LegacyReference = {
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      workspaceId: 'w1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      title: 'Minimal',
      authors: [],
      tags: [],
      createdBy: 'user-1',
      createdAt: now,
      updatedAt: now,
    };
    const entry = referenceToEntry(ref);
    expect(entry.entryType).toBe('reference');
    expect(entry.metadata).toMatchObject({ authors: [] });
  });
});

describe('entryToReference', () => {
  it('converts KB entry back to legacy reference', () => {
    const ref = makeLegacyReference();
    const entry = referenceToEntry(ref);
    const roundTripped = entryToReference(entry);

    expect(roundTripped.id).toBe(ref.id);
    expect(roundTripped.doi).toBe(ref.doi);
    expect(roundTripped.authors).toEqual(ref.authors);
    expect(roundTripped.journal).toBe(ref.journal);
    expect(roundTripped.year).toBe(ref.year);
  });

  it('throws for non-reference entry type', () => {
    const entry: KBEntry = {
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      workspaceId: 'w1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      entryType: 'note',
      title: 'A note',
      metadata: { body: 'text', format: 'markdown', pinned: false },
      tags: [],
      version: 1,
      corpus: 'knowledge',
      jurisdiction: null,
      createdBy: 'user-1',
      createdAt: now,
      updatedAt: now,
    };
    expect(() => entryToReference(entry)).toThrow('Cannot convert entry of type "note"');
  });

  it('round-trips reference data faithfully', () => {
    const ref = makeLegacyReference();
    const roundTripped = entryToReference(referenceToEntry(ref));

    expect(roundTripped.title).toBe(ref.title);
    expect(roundTripped.tags).toEqual(ref.tags);
    expect(roundTripped.publisher).toBe(ref.publisher);
    expect(roundTripped.volume).toBe(ref.volume);
    expect(roundTripped.issue).toBe(ref.issue);
    expect(roundTripped.pages).toBe(ref.pages);
    expect(roundTripped.abstract).toBe(ref.abstract);
  });
});
