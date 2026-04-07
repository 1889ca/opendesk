/** Contract: contracts/references/rules.md -- Verification tests */
import { describe, it, expect } from 'vitest';
import {
  AuthorSchema,
  ReferenceTypeSchema,
  ReferenceSchema,
  ReferenceCreateInputSchema,
  ReferenceUpdateInputSchema,
  CitationAttrsSchema,
  DocumentCitationSchema,
  REFERENCE_TYPES,
} from './contract.ts';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const now = new Date().toISOString();

describe('AuthorSchema', () => {
  it('accepts all optional fields', () => {
    expect(AuthorSchema.parse({})).toEqual({});
  });

  it('accepts given + family', () => {
    const result = AuthorSchema.parse({ given: 'Jane', family: 'Doe' });
    expect(result.given).toBe('Jane');
    expect(result.family).toBe('Doe');
  });

  it('accepts literal name', () => {
    const result = AuthorSchema.parse({ literal: 'World Health Organization' });
    expect(result.literal).toBe('World Health Organization');
  });

  it('rejects non-string fields', () => {
    expect(() => AuthorSchema.parse({ given: 123 })).toThrow();
  });
});

describe('ReferenceTypeSchema', () => {
  it('accepts all valid types', () => {
    for (const t of REFERENCE_TYPES) {
      expect(ReferenceTypeSchema.parse(t)).toBe(t);
    }
  });

  it('rejects invalid type', () => {
    expect(() => ReferenceTypeSchema.parse('newspaper')).toThrow();
  });
});

describe('ReferenceSchema', () => {
  const validRef = {
    id: validUUID,
    workspaceId: validUUID,
    type: 'article-journal' as const,
    title: 'Test Article',
    authors: [{ given: 'Jane', family: 'Doe' }],
    issuedDate: '2024-01',
    containerTitle: 'Nature',
    volume: '42',
    issue: '3',
    pages: '100-110',
    doi: '10.1234/test',
    url: 'https://example.com',
    isbn: null,
    abstract: 'An abstract.',
    publisher: 'Springer',
    language: 'en',
    customFields: {},
    tags: ['biology'],
    createdBy: 'user-1',
    createdAt: now,
    updatedAt: now,
  };

  it('accepts a valid full reference', () => {
    const result = ReferenceSchema.parse(validRef);
    expect(result.id).toBe(validUUID);
    expect(result.title).toBe('Test Article');
  });

  it('rejects missing title', () => {
    expect(() => ReferenceSchema.parse({ ...validRef, title: '' })).toThrow();
  });

  it('rejects non-UUID id', () => {
    expect(() => ReferenceSchema.parse({ ...validRef, id: 'not-a-uuid' })).toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => ReferenceSchema.parse({ ...validRef, type: 'zine' })).toThrow();
  });
});

describe('ReferenceCreateInputSchema', () => {
  it('requires only title', () => {
    const result = ReferenceCreateInputSchema.parse({ title: 'Minimal Ref' });
    expect(result.title).toBe('Minimal Ref');
    expect(result.type).toBe('article-journal');
    expect(result.authors).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it('rejects empty title', () => {
    expect(() => ReferenceCreateInputSchema.parse({ title: '' })).toThrow();
  });

  it('accepts all optional fields', () => {
    const input = {
      title: 'Full Ref',
      authors: [{ given: 'A', family: 'B' }],
      type: 'book' as const,
      doi: '10.1234/full',
      volume: '1',
      tags: ['math', 'cs'],
    };
    const result = ReferenceCreateInputSchema.parse(input);
    expect(result.type).toBe('book');
    expect(result.tags).toEqual(['math', 'cs']);
  });
});

describe('ReferenceUpdateInputSchema', () => {
  it('accepts empty object (no updates)', () => {
    const result = ReferenceUpdateInputSchema.parse({});
    expect(result).toEqual({});
  });

  it('accepts partial updates', () => {
    const result = ReferenceUpdateInputSchema.parse({ title: 'New Title', volume: '5' });
    expect(result.title).toBe('New Title');
    expect(result.volume).toBe('5');
  });

  it('rejects empty title when provided', () => {
    expect(() => ReferenceUpdateInputSchema.parse({ title: '' })).toThrow();
  });
});

describe('CitationAttrsSchema', () => {
  it('requires referenceId as UUID', () => {
    const result = CitationAttrsSchema.parse({ referenceId: validUUID });
    expect(result.referenceId).toBe(validUUID);
  });

  it('rejects non-UUID referenceId', () => {
    expect(() => CitationAttrsSchema.parse({ referenceId: 'bad' })).toThrow();
  });

  it('accepts optional locator, prefix, suffix', () => {
    const result = CitationAttrsSchema.parse({
      referenceId: validUUID,
      locator: 'p. 42',
      prefix: 'see',
      suffix: 'emphasis added',
    });
    expect(result.locator).toBe('p. 42');
    expect(result.prefix).toBe('see');
    expect(result.suffix).toBe('emphasis added');
  });
});

describe('DocumentCitationSchema', () => {
  it('accepts a valid document citation', () => {
    const result = DocumentCitationSchema.parse({
      id: validUUID,
      documentId: validUUID,
      referenceId: validUUID,
      locator: 'ch. 3',
      createdAt: now,
    });
    expect(result.documentId).toBe(validUUID);
  });

  it('rejects missing documentId', () => {
    expect(() =>
      DocumentCitationSchema.parse({
        id: validUUID,
        referenceId: validUUID,
        createdAt: now,
      }),
    ).toThrow();
  });

  it('accepts null locator', () => {
    const result = DocumentCitationSchema.parse({
      id: validUUID,
      documentId: validUUID,
      referenceId: validUUID,
      locator: null,
      createdAt: now,
    });
    expect(result.locator).toBeNull();
  });
});
