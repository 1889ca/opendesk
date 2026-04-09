/** Contract: contracts/ai/rules.md */
import { describe, it, expect } from 'vitest';
import {
  textDocumentExtractor,
  spreadsheetExtractor,
  presentationExtractor,
  getExtractor,
  listExtractorTypes,
  registerExtractor,
} from './extractors.ts';
import type { TextDocumentSnapshot } from '../../document/contract/text.ts';
import type { SpreadsheetDocumentSnapshot } from '../../document/contract/spreadsheet.ts';
import type { PresentationDocumentSnapshot } from '../../document/contract/presentation.ts';

describe('Extractor registry', () => {
  it('has built-in text, spreadsheet, and presentation extractors', () => {
    const types = listExtractorTypes();
    expect(types).toContain('text');
    expect(types).toContain('spreadsheet');
    expect(types).toContain('presentation');
  });

  it('retrieves registered extractors', () => {
    expect(getExtractor('text')).toBeDefined();
    expect(getExtractor('spreadsheet')).toBeDefined();
    expect(getExtractor('presentation')).toBeDefined();
  });

  it('allows registering custom extractors', () => {
    registerExtractor('kb-note', (entry: unknown) => String(entry));
    expect(getExtractor('kb-note')).toBeDefined();
  });
});

describe('textDocumentExtractor', () => {
  it('extracts text from ProseMirror nodes', () => {
    const snapshot: TextDocumentSnapshot = {
      documentType: 'text',
      schemaVersion: '1.0.0',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { blockId: '550e8400-e29b-41d4-a716-446655440000' },
            content: [{ type: 'text', text: 'Hello world' }],
          },
          {
            type: 'heading',
            attrs: { blockId: '550e8400-e29b-41d4-a716-446655440001', level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
        ],
      },
    };

    const result = textDocumentExtractor(snapshot);
    expect(result).toContain('Hello world');
    expect(result).toContain('Title');
  });

  it('handles empty document', () => {
    const snapshot: TextDocumentSnapshot = {
      documentType: 'text',
      schemaVersion: '1.0.0',
      content: { type: 'doc', content: [] },
    };

    const result = textDocumentExtractor(snapshot);
    expect(result).toBe('');
  });
});

describe('spreadsheetExtractor', () => {
  it('extracts sheet names and cell values', () => {
    const snapshot: SpreadsheetDocumentSnapshot = {
      documentType: 'spreadsheet',
      schemaVersion: '1.0.0',
      content: {
        sheets: [
          {
            name: 'Revenue',
            columns: [{ width: 100 }, { width: 100 }],
            rows: [
              { cells: [{ value: 'Q1' }, { value: 1000 }] },
              { cells: [{ value: 'Q2' }, { value: 2000 }] },
            ],
          },
        ],
      },
    };

    const result = spreadsheetExtractor(snapshot);
    expect(result).toContain('Revenue');
    expect(result).toContain('Q1');
    expect(result).toContain('1000');
  });

  it('extracts formula descriptions', () => {
    const snapshot: SpreadsheetDocumentSnapshot = {
      documentType: 'spreadsheet',
      schemaVersion: '1.0.0',
      content: {
        sheets: [
          {
            name: 'Sheet1',
            columns: [{ width: 100 }],
            rows: [
              { cells: [{ value: 3000, formula: '=SUM(A1:A2)' }] },
            ],
          },
        ],
      },
    };

    const result = spreadsheetExtractor(snapshot);
    expect(result).toContain('=SUM(A1:A2)');
  });
});

describe('presentationExtractor', () => {
  it('extracts text from slide elements', () => {
    const snapshot: PresentationDocumentSnapshot = {
      documentType: 'presentation',
      schemaVersion: '1.0.0',
      content: {
        slides: [
          {
            layout: 'title',
            elements: [
              {
                id: '550e8400-e29b-41d4-a716-446655440000',
                type: 'text',
                x: 0,
                y: 0,
                width: 100,
                height: 50,
                content: 'Welcome to OpenDesk',
              },
            ],
          },
          {
            layout: 'content',
            elements: [
              {
                id: '550e8400-e29b-41d4-a716-446655440001',
                type: 'text',
                x: 0,
                y: 0,
                width: 100,
                height: 50,
                content: 'Bullet point one',
              },
            ],
          },
        ],
      },
    };

    const result = presentationExtractor(snapshot);
    expect(result).toContain('Slide 1:');
    expect(result).toContain('Welcome to OpenDesk');
    expect(result).toContain('Slide 2:');
    expect(result).toContain('Bullet point one');
  });
});
