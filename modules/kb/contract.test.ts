/** Contract: contracts/kb/rules.md */
import { describe, it, expect } from 'vitest';
import {
  KbEntryTypeSchema,
  KbCorpusSchema,
  KbLifecycleSchema,
  KbEntryCreateInputSchema,
  KbEntryUpdateInputSchema,
  KbEntrySchema,
  VALID_LIFECYCLE_TRANSITIONS,
  KB_ENTRY_TYPES,
  KB_CORPUS_VALUES,
  KB_LIFECYCLE_VALUES,
} from './contract.ts';

describe('KB contract schemas', () => {
  describe('KbEntryTypeSchema', () => {
    it('accepts all valid entry types', () => {
      for (const type of KB_ENTRY_TYPES) {
        expect(KbEntryTypeSchema.parse(type)).toBe(type);
      }
    });

    it('rejects invalid entry type', () => {
      expect(() => KbEntryTypeSchema.parse('invalid')).toThrow();
    });
  });

  describe('KbCorpusSchema', () => {
    it('accepts all valid corpus values', () => {
      for (const corpus of KB_CORPUS_VALUES) {
        expect(KbCorpusSchema.parse(corpus)).toBe(corpus);
      }
    });

    it('rejects invalid corpus', () => {
      expect(() => KbCorpusSchema.parse('invalid')).toThrow();
    });
  });

  describe('KbLifecycleSchema', () => {
    it('accepts all valid lifecycle values', () => {
      for (const lc of KB_LIFECYCLE_VALUES) {
        expect(KbLifecycleSchema.parse(lc)).toBe(lc);
      }
    });

    it('rejects invalid lifecycle', () => {
      expect(() => KbLifecycleSchema.parse('deleted')).toThrow();
    });
  });

  describe('VALID_LIFECYCLE_TRANSITIONS', () => {
    it('allows draft -> published', () => {
      expect(VALID_LIFECYCLE_TRANSITIONS.draft).toContain('published');
    });

    it('allows published -> archived', () => {
      expect(VALID_LIFECYCLE_TRANSITIONS.published).toContain('archived');
    });

    it('disallows backward transitions', () => {
      expect(VALID_LIFECYCLE_TRANSITIONS.published).not.toContain('draft');
      expect(VALID_LIFECYCLE_TRANSITIONS.archived).toHaveLength(0);
    });

    it('disallows skip transitions', () => {
      expect(VALID_LIFECYCLE_TRANSITIONS.draft).not.toContain('archived');
    });
  });

  describe('KbEntryCreateInputSchema', () => {
    it('accepts valid note input', () => {
      const input = {
        title: 'Test Note',
        entryType: 'note',
        corpus: 'knowledge',
        content: { content: 'Some note text' },
      };
      expect(() => KbEntryCreateInputSchema.parse(input)).not.toThrow();
    });

    it('accepts valid glossary input', () => {
      const input = {
        title: 'Test Term',
        entryType: 'glossary',
        content: { term: 'API', definition: 'Application Programming Interface' },
      };
      expect(() => KbEntryCreateInputSchema.parse(input)).not.toThrow();
    });

    it('rejects empty title', () => {
      const input = {
        title: '',
        entryType: 'note',
        content: { content: 'text' },
      };
      expect(() => KbEntryCreateInputSchema.parse(input)).toThrow();
    });

    it('defaults corpus to knowledge', () => {
      const input = {
        title: 'Test',
        entryType: 'note',
        content: { content: 'text' },
      };
      const parsed = KbEntryCreateInputSchema.parse(input);
      expect(parsed.corpus).toBe('knowledge');
    });

    it('defaults tags to empty array', () => {
      const input = {
        title: 'Test',
        entryType: 'note',
        content: { content: 'text' },
      };
      const parsed = KbEntryCreateInputSchema.parse(input);
      expect(parsed.tags).toEqual([]);
    });
  });

  describe('KbEntrySchema (full record)', () => {
    const validEntry = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      entryType: 'entity',
      corpus: 'reference',
      lifecycle: 'published',
      title: 'Test Entity',
      tags: ['test'],
      content: { description: 'A test entity', metadata: {} },
      createdBy: 'user-1',
      createdAt: '2026-04-08T00:00:00Z',
      updatedAt: '2026-04-08T00:00:00Z',
    };

    it('accepts valid full entry', () => {
      expect(() => KbEntrySchema.parse(validEntry)).not.toThrow();
    });

    it('rejects entry with non-UUID id', () => {
      expect(() =>
        KbEntrySchema.parse({ ...validEntry, id: 'not-a-uuid' }),
      ).toThrow();
    });

    it('rejects entry with empty title', () => {
      expect(() =>
        KbEntrySchema.parse({ ...validEntry, title: '' }),
      ).toThrow();
    });
  });

  describe('KbEntryUpdateInputSchema', () => {
    it('accepts partial update with just title', () => {
      const input = { title: 'New Title' };
      expect(() => KbEntryUpdateInputSchema.parse(input)).not.toThrow();
    });

    it('accepts empty update (no fields)', () => {
      expect(() => KbEntryUpdateInputSchema.parse({})).not.toThrow();
    });

    it('rejects empty title when provided', () => {
      expect(() =>
        KbEntryUpdateInputSchema.parse({ title: '' }),
      ).toThrow();
    });
  });
});
