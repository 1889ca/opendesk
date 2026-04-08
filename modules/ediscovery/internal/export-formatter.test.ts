/** Contract: contracts/ediscovery/rules.md */

import { describe, it, expect } from 'vitest';
import { formatExport } from './export-formatter.ts';
import type { SarExportResult, FoiaExportResult } from '../contract.ts';

const sarResult: SarExportResult = {
  userId: 'user-1',
  documents: [
    { id: 'doc-1', title: 'Test Doc', documentType: 'text', role: 'owner', createdAt: '2025-01-01T00:00:00.000Z' },
  ],
  auditEvents: [
    { id: 'ae-1', eventId: 'evt-1', documentId: 'doc-1', actorId: 'user-1', actorType: 'human', action: 'DocumentUpdated', occurredAt: '2025-01-01T00:00:00.000Z' },
  ],
  signatureCount: 5,
  exportedAt: '2025-06-01T00:00:00.000Z',
};

const foiaResult: FoiaExportResult = {
  documentId: 'doc-1',
  dateRange: { start: '2025-01-01T00:00:00.000Z', end: '2025-06-01T00:00:00.000Z' },
  auditTrail: [
    { id: 'ae-1', eventId: 'evt-1', documentId: 'doc-1', actorId: 'user-1', actorType: 'human', action: 'DocumentUpdated', occurredAt: '2025-01-01T00:00:00.000Z' },
  ],
  versions: [
    { id: 'v-1', title: 'Initial', versionNumber: 1, createdBy: 'user-1', createdAt: '2025-01-01T00:00:00.000Z' },
  ],
  signatureVerification: { documentId: 'doc-1', totalUpdates: 3, verified: true, failedAt: null, failedActorId: null },
  exportedAt: '2025-06-01T00:00:00.000Z',
};

describe('export-formatter', () => {
  describe('SAR exports', () => {
    it('formats SAR as JSON', () => {
      const bundle = formatExport(sarResult, 'json', 'sar');
      expect(bundle.format).toBe('json');
      expect(bundle.contentType).toBe('application/json');
      expect(bundle.filename).toContain('sar-export-user-1');
      const parsed = JSON.parse(bundle.data as string);
      expect(parsed.userId).toBe('user-1');
    });

    it('formats SAR as CSV', () => {
      const bundle = formatExport(sarResult, 'csv', 'sar');
      expect(bundle.format).toBe('csv');
      expect(bundle.contentType).toBe('text/csv');
      const csv = bundle.data as string;
      expect(csv).toContain('id,eventId,documentId');
      expect(csv).toContain('DocumentUpdated');
    });

    it('formats SAR as text report', () => {
      const bundle = formatExport(sarResult, 'pdf', 'sar');
      expect(bundle.format).toBe('pdf');
      const text = bundle.data as string;
      expect(text).toContain('SUBJECT ACCESS REQUEST');
      expect(text).toContain('user-1');
    });
  });

  describe('FOIA exports', () => {
    it('formats FOIA as JSON', () => {
      const bundle = formatExport(foiaResult, 'json', 'foia');
      expect(bundle.format).toBe('json');
      const parsed = JSON.parse(bundle.data as string);
      expect(parsed.documentId).toBe('doc-1');
    });

    it('formats FOIA as CSV', () => {
      const bundle = formatExport(foiaResult, 'csv', 'foia');
      const csv = bundle.data as string;
      expect(csv).toContain('DocumentUpdated');
    });

    it('formats FOIA as text report', () => {
      const bundle = formatExport(foiaResult, 'pdf', 'foia');
      const text = bundle.data as string;
      expect(text).toContain('FOIA DOCUMENT HISTORY');
      expect(text).toContain('Signature Verification: PASSED');
    });
  });

  it('escapes CSV fields with commas', () => {
    const result: SarExportResult = {
      ...sarResult,
      auditEvents: [
        { id: 'ae-1', eventId: 'evt-1', documentId: 'doc,with,commas', actorId: 'user-1', actorType: 'human', action: 'Test', occurredAt: '2025-01-01T00:00:00.000Z' },
      ],
    };
    const bundle = formatExport(result, 'csv', 'sar');
    const csv = bundle.data as string;
    expect(csv).toContain('"doc,with,commas"');
  });
});
