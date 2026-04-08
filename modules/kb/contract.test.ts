/** Contract: contracts/kb/rules.md */
import { describe, it, expect } from 'vitest';
import {
  KbEntryStatusSchema,
  KbEntrySchema,
  KbEntryCreateInputSchema,
  KbEntryUpdateInputSchema,
  KbEntryVersionSchema,
  KbVersionRefSchema,
  ResolvedReferenceSchema,
  STATUS_TRANSITIONS,
} from './contract.ts';

describe('KbEntryStatusSchema', () => {
  it('accepts valid statuses', () => {
    for (const s of ['draft', 'reviewed', 'published', 'deprecated']) {
      expect(KbEntryStatusSchema.parse(s)).toBe(s);
    }
  });

  it('rejects invalid status', () => {
    expect(() => KbEntryStatusSchema.parse('archived')).toThrow();
  });
});

describe('STATUS_TRANSITIONS', () => {
  it('draft can only transition to reviewed', () => {
    expect(STATUS_TRANSITIONS.draft).toEqual(['reviewed']);
  });

  it('reviewed can transition to published or draft', () => {
    expect(STATUS_TRANSITIONS.reviewed).toEqual(['published', 'draft']);
  });

  it('published can only transition to deprecated', () => {
    expect(STATUS_TRANSITIONS.published).toEqual(['deprecated']);
  });

  it('deprecated has no transitions', () => {
    expect(STATUS_TRANSITIONS.deprecated).toEqual([]);
  });
});

describe('KbEntrySchema', () => {
  const valid = {
    id: '00000000-0000-0000-0000-000000000001',
    workspaceId: '00000000-0000-0000-0000-000000000000',
    title: 'Test Entry',
    body: 'Some content',
    status: 'draft',
    version: 1,
    tags: ['test'],
    metadata: {},
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('parses a valid entry', () => {
    expect(KbEntrySchema.parse(valid)).toMatchObject({ title: 'Test Entry' });
  });

  it('rejects missing title', () => {
    expect(() => KbEntrySchema.parse({ ...valid, title: '' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => KbEntrySchema.parse({ ...valid, status: 'unknown' })).toThrow();
  });
});

describe('KbEntryCreateInputSchema', () => {
  it('parses minimal input with defaults', () => {
    const result = KbEntryCreateInputSchema.parse({ title: 'New' });
    expect(result.body).toBe('');
    expect(result.tags).toEqual([]);
    expect(result.metadata).toEqual({});
  });
});

describe('KbEntryUpdateInputSchema', () => {
  it('accepts partial updates', () => {
    const result = KbEntryUpdateInputSchema.parse({ title: 'Updated' });
    expect(result.title).toBe('Updated');
    expect(result.body).toBeUndefined();
  });
});

describe('KbVersionRefSchema', () => {
  it('accepts pinned version', () => {
    const ref = KbVersionRefSchema.parse({
      entryId: '00000000-0000-0000-0000-000000000001',
      version: 3,
    });
    expect(ref.version).toBe(3);
  });

  it('accepts latest', () => {
    const ref = KbVersionRefSchema.parse({
      entryId: '00000000-0000-0000-0000-000000000001',
      version: 'latest',
    });
    expect(ref.version).toBe('latest');
  });

  it('rejects zero version', () => {
    expect(() => KbVersionRefSchema.parse({
      entryId: '00000000-0000-0000-0000-000000000001',
      version: 0,
    })).toThrow();
  });
});

describe('KbEntryVersionSchema', () => {
  it('parses a valid version snapshot', () => {
    const v = KbEntryVersionSchema.parse({
      id: '00000000-0000-0000-0000-000000000002',
      entryId: '00000000-0000-0000-0000-000000000001',
      version: 1,
      title: 'V1',
      body: 'Content',
      tags: [],
      metadata: {},
      createdBy: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(v.version).toBe(1);
  });
});

describe('ResolvedReferenceSchema', () => {
  it('parses a resolved reference', () => {
    const r = ResolvedReferenceSchema.parse({
      entryId: '00000000-0000-0000-0000-000000000001',
      version: 5,
      title: 'Resolved',
      body: 'Content',
      status: 'published',
      resolvedAt: '2026-01-01T00:00:00Z',
    });
    expect(r.version).toBe(5);
  });
});
