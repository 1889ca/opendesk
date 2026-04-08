/** Contract: contracts/ai/rules.md */
import { describe, it, expect } from 'vitest';
import {
  SourceTypeSchema,
  ExtractorTypeSchema,
  EmbeddingRecordSchema,
  SemanticSearchResultSchema,
  RagQueryOptionsSchema,
  EmbedderConfigSchema,
  SOURCE_TYPES,
  EXTRACTOR_TYPES,
  RAG_CORPUS_FILTER,
} from './contract.ts';

describe('AI contract schemas', () => {
  describe('SourceTypeSchema', () => {
    it('accepts all valid source types', () => {
      for (const st of SOURCE_TYPES) {
        expect(SourceTypeSchema.parse(st)).toBe(st);
      }
    });

    it('rejects invalid source type', () => {
      expect(() => SourceTypeSchema.parse('invalid')).toThrow();
    });
  });

  describe('ExtractorTypeSchema', () => {
    it('accepts all valid extractor types', () => {
      for (const et of EXTRACTOR_TYPES) {
        expect(ExtractorTypeSchema.parse(et)).toBe(et);
      }
    });

    it('includes document types and KB types', () => {
      expect(EXTRACTOR_TYPES).toContain('text');
      expect(EXTRACTOR_TYPES).toContain('spreadsheet');
      expect(EXTRACTOR_TYPES).toContain('presentation');
      expect(EXTRACTOR_TYPES).toContain('kb-reference');
      expect(EXTRACTOR_TYPES).toContain('kb-entity');
      expect(EXTRACTOR_TYPES).toContain('kb-dataset');
      expect(EXTRACTOR_TYPES).toContain('kb-note');
      expect(EXTRACTOR_TYPES).toContain('kb-glossary');
    });
  });

  describe('RAG_CORPUS_FILTER', () => {
    it('includes knowledge and reference only', () => {
      expect(RAG_CORPUS_FILTER).toEqual(['knowledge', 'reference']);
    });

    it('excludes operational', () => {
      expect(RAG_CORPUS_FILTER).not.toContain('operational');
    });
  });

  describe('EmbeddingRecordSchema', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      sourceId: 'doc-1',
      sourceType: 'document',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      chunkIndex: 0,
      chunkText: 'Some text chunk',
      createdAt: '2026-04-08T00:00:00Z',
    };

    it('accepts valid embedding record', () => {
      expect(() => EmbeddingRecordSchema.parse(valid)).not.toThrow();
    });

    it('rejects negative chunk index', () => {
      expect(() =>
        EmbeddingRecordSchema.parse({ ...valid, chunkIndex: -1 }),
      ).toThrow();
    });

    it('rejects empty chunk text', () => {
      expect(() =>
        EmbeddingRecordSchema.parse({ ...valid, chunkText: '' }),
      ).toThrow();
    });
  });

  describe('SemanticSearchResultSchema', () => {
    it('accepts valid result', () => {
      const result = {
        sourceId: 'doc-1',
        sourceType: 'kb-entry',
        chunkText: 'Some text',
        similarity: 0.85,
      };
      expect(() => SemanticSearchResultSchema.parse(result)).not.toThrow();
    });

    it('rejects similarity > 1', () => {
      expect(() =>
        SemanticSearchResultSchema.parse({
          sourceId: 'x',
          sourceType: 'document',
          chunkText: 'y',
          similarity: 1.5,
        }),
      ).toThrow();
    });

    it('rejects similarity < 0', () => {
      expect(() =>
        SemanticSearchResultSchema.parse({
          sourceId: 'x',
          sourceType: 'document',
          chunkText: 'y',
          similarity: -0.1,
        }),
      ).toThrow();
    });
  });

  describe('RagQueryOptionsSchema', () => {
    it('accepts valid options with defaults', () => {
      const opts = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        query: 'What is CRDT?',
      };
      const parsed = RagQueryOptionsSchema.parse(opts);
      expect(parsed.limit).toBe(10);
      expect(parsed.kbBoostFactor).toBe(1.5);
      expect(parsed.includeDocuments).toBe(true);
      expect(parsed.includeKb).toBe(true);
    });

    it('rejects empty query', () => {
      expect(() =>
        RagQueryOptionsSchema.parse({
          workspaceId: '550e8400-e29b-41d4-a716-446655440000',
          query: '',
        }),
      ).toThrow();
    });

    it('rejects non-positive limit', () => {
      expect(() =>
        RagQueryOptionsSchema.parse({
          workspaceId: '550e8400-e29b-41d4-a716-446655440000',
          query: 'test',
          limit: 0,
        }),
      ).toThrow();
    });
  });

  describe('EmbedderConfigSchema', () => {
    it('applies defaults', () => {
      const parsed = EmbedderConfigSchema.parse({});
      expect(parsed.chunkSize).toBe(512);
      expect(parsed.chunkOverlap).toBe(64);
      expect(parsed.embeddingDimensions).toBe(768);
    });
  });
});
