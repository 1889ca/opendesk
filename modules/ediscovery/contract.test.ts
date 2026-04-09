/** Contract: contracts/ediscovery/rules.md */

import { describe, it, expect } from 'vitest';
import {
  SarRequestSchema,
  FoiaRequestSchema,
  ExportFormatSchema,
  SarExportResultSchema,
  FoiaExportResultSchema,
  DocumentSummarySchema,
  VersionSummarySchema,
} from './contract.ts';

describe('ediscovery contract schemas', () => {
  describe('SarRequestSchema', () => {
    it('accepts valid SAR request', () => {
      expect(SarRequestSchema.parse({ userId: 'user-1' })).toEqual({ userId: 'user-1' });
    });

    it('rejects empty userId', () => {
      expect(() => SarRequestSchema.parse({ userId: '' })).toThrow();
    });

    it('rejects missing userId', () => {
      expect(() => SarRequestSchema.parse({})).toThrow();
    });
  });

  describe('FoiaRequestSchema', () => {
    it('accepts valid FOIA request', () => {
      const result = FoiaRequestSchema.parse({ documentId: 'doc-1' });
      expect(result.documentId).toBe('doc-1');
    });

    it('accepts with date range', () => {
      const result = FoiaRequestSchema.parse({
        documentId: 'doc-1',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-06-01T00:00:00.000Z',
      });
      expect(result.startDate).toBe('2025-01-01T00:00:00.000Z');
    });

    it('rejects empty documentId', () => {
      expect(() => FoiaRequestSchema.parse({ documentId: '' })).toThrow();
    });
  });

  describe('ExportFormatSchema', () => {
    it('accepts json, csv, pdf', () => {
      expect(ExportFormatSchema.parse('json')).toBe('json');
      expect(ExportFormatSchema.parse('csv')).toBe('csv');
      expect(ExportFormatSchema.parse('pdf')).toBe('pdf');
    });

    it('rejects invalid format', () => {
      expect(() => ExportFormatSchema.parse('xml')).toThrow();
    });
  });

  describe('DocumentSummarySchema', () => {
    it('accepts valid document summary', () => {
      const doc = {
        id: 'doc-1',
        title: 'Test',
        documentType: 'text',
        role: 'owner',
        createdAt: '2025-01-01',
      };
      expect(DocumentSummarySchema.parse(doc).id).toBe('doc-1');
    });
  });

  describe('VersionSummarySchema', () => {
    it('accepts valid version summary', () => {
      const ver = {
        id: 'v-1',
        title: 'v1',
        versionNumber: 1,
        createdBy: 'user-1',
        createdAt: '2025-01-01',
      };
      expect(VersionSummarySchema.parse(ver).versionNumber).toBe(1);
    });
  });

  describe('SarExportResultSchema', () => {
    it('accepts valid SAR export result', () => {
      const result = {
        userId: 'user-1',
        documents: [],
        auditEvents: [],
        signatureCount: 0,
        exportedAt: '2025-06-01T00:00:00.000Z',
      };
      expect(SarExportResultSchema.parse(result).userId).toBe('user-1');
    });
  });

  describe('FoiaExportResultSchema', () => {
    it('accepts valid FOIA export result', () => {
      const result = {
        documentId: 'doc-1',
        dateRange: { start: '2025-01-01T00:00:00.000Z', end: '2025-06-01T00:00:00.000Z' },
        auditTrail: [],
        versions: [],
        signatureVerification: null,
        exportedAt: '2025-06-01T00:00:00.000Z',
      };
      expect(FoiaExportResultSchema.parse(result).documentId).toBe('doc-1');
    });
  });
});
