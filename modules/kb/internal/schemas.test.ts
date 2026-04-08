/** Contract: contracts/kb/rules.md — Schema validation tests */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  EntryTypeSchema,
  EntitySubtypeSchema,
  ReferenceMetadataSchema,
  EntityMetadataSchema,
  DatasetMetadataSchema,
  NoteMetadataSchema,
  getMetadataSchema,
  normalizeTags,
} from './schemas.ts';

// --- EntryType ---

describe('EntryTypeSchema', () => {
  it.each(['reference', 'entity', 'dataset', 'note'])('accepts "%s"', (type) => {
    expect(EntryTypeSchema.safeParse(type).success).toBe(true);
  });

  it('rejects unknown types', () => {
    expect(EntryTypeSchema.safeParse('spreadsheet').success).toBe(false);
  });
});

// --- Type-specific metadata ---

describe('ReferenceMetadataSchema', () => {
  it('accepts valid reference metadata', () => {
    const result = ReferenceMetadataSchema.safeParse({
      doi: '10.1000/xyz123',
      authors: ['Alice', 'Bob'],
      journal: 'Nature',
      year: 2024,
    });
    expect(result.success).toBe(true);
  });

  it('accepts minimal reference metadata', () => {
    expect(ReferenceMetadataSchema.safeParse({}).success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = ReferenceMetadataSchema.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});

describe('EntityMetadataSchema', () => {
  it('accepts valid entity metadata', () => {
    const result = EntityMetadataSchema.safeParse({
      entityType: 'person',
      description: 'A researcher',
      aliases: ['Dr. Smith'],
    });
    expect(result.success).toBe(true);
  });

  it('requires entityType', () => {
    expect(EntityMetadataSchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid entityType', () => {
    expect(EntityMetadataSchema.safeParse({ entityType: 'robot' }).success).toBe(false);
  });
});

describe('DatasetMetadataSchema', () => {
  it('accepts valid dataset metadata', () => {
    const result = DatasetMetadataSchema.safeParse({
      format: 'csv',
      rowCount: 1000,
      columns: [{ name: 'id', type: 'integer' }],
    });
    expect(result.success).toBe(true);
  });

  it('requires format', () => {
    expect(DatasetMetadataSchema.safeParse({}).success).toBe(false);
  });
});

describe('NoteMetadataSchema', () => {
  it('accepts valid note metadata', () => {
    const result = NoteMetadataSchema.safeParse({
      body: '# My Note\nSome text',
      format: 'markdown',
    });
    expect(result.success).toBe(true);
  });

  it('uses defaults for empty input', () => {
    const result = NoteMetadataSchema.parse({});
    expect(result.body).toBe('');
    expect(result.format).toBe('markdown');
    expect(result.pinned).toBe(false);
  });
});

// --- getMetadataSchema ---

describe('getMetadataSchema', () => {
  it('returns correct schema for each type', () => {
    expect(getMetadataSchema('reference')).toBe(ReferenceMetadataSchema);
    expect(getMetadataSchema('entity')).toBe(EntityMetadataSchema);
    expect(getMetadataSchema('dataset')).toBe(DatasetMetadataSchema);
    expect(getMetadataSchema('note')).toBe(NoteMetadataSchema);
  });

  it('throws for unknown type', () => {
    expect(() => getMetadataSchema('unknown')).toThrow('Unknown entry type');
  });
});

// --- normalizeTags ---

describe('normalizeTags', () => {
  it('lowercases and trims tags', () => {
    expect(normalizeTags([' Physics ', 'MATH'])).toEqual(['physics', 'math']);
  });

  it('deduplicates tags', () => {
    expect(normalizeTags(['ai', 'AI', 'Ai'])).toEqual(['ai']);
  });

  it('removes empty tags', () => {
    expect(normalizeTags(['valid', '', '  '])).toEqual(['valid']);
  });

  it('returns empty array for empty input', () => {
    expect(normalizeTags([])).toEqual([]);
  });
});

