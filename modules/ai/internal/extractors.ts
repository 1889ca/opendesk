/** Contract: contracts/ai/rules.md */
import type { TextExtractor, ExtractorType } from '../contract.ts';
import type { TextDocumentSnapshot, ProseMirrorNode } from '../../document/contract/text.ts';
import type { SpreadsheetDocumentSnapshot } from '../../document/contract/spreadsheet.ts';
import type { PresentationDocumentSnapshot } from '../../document/contract/presentation.ts';

// --- Registry ---

const registry = new Map<ExtractorType, TextExtractor>();

/** Register a text extractor for a given type. */
export function registerExtractor<T>(
  type: ExtractorType,
  extractor: TextExtractor<T>,
): void {
  registry.set(type, extractor as TextExtractor);
}

/** Get a registered extractor by type. */
export function getExtractor(type: ExtractorType): TextExtractor | undefined {
  return registry.get(type);
}

/** Get all registered extractor types. */
export function listExtractorTypes(): ExtractorType[] {
  return [...registry.keys()];
}

// --- Text Document Extractor ---

function extractProseMirrorText(node: ProseMirrorNode): string {
  const parts: string[] = [];
  if (node.text) parts.push(node.text);
  if (node.content) {
    for (const child of node.content) {
      parts.push(extractProseMirrorText(child));
    }
  }
  return parts.join(' ');
}

export const textDocumentExtractor: TextExtractor<TextDocumentSnapshot> = (
  snapshot: TextDocumentSnapshot,
) => {
  return snapshot.content.content
    .map(extractProseMirrorText)
    .filter(Boolean)
    .join('\n');
};

// --- Spreadsheet Extractor ---

export const spreadsheetExtractor: TextExtractor<SpreadsheetDocumentSnapshot> = (
  snapshot: SpreadsheetDocumentSnapshot,
) => {
  const parts: string[] = [];

  for (const sheet of snapshot.content.sheets) {
    parts.push(`Sheet: ${sheet.name}`);

    // Column names from first row if it looks like a header
    const colNames = sheet.columns.map((_c: unknown, i: number) => `Column ${i + 1}`);
    parts.push(`Columns: ${colNames.join(', ')}`);

    for (const row of sheet.rows) {
      const cellTexts = row.cells
        .map((cell: { value?: unknown; formula?: string }) => {
          const parts: string[] = [];
          if (cell.value !== null && cell.value !== undefined) {
            parts.push(String(cell.value));
          }
          if (cell.formula) {
            parts.push(`(formula: ${cell.formula})`);
          }
          return parts.join(' ');
        })
        .filter(Boolean);

      if (cellTexts.length > 0) {
        parts.push(cellTexts.join(' | '));
      }
    }
  }

  return parts.join('\n');
};

// --- Presentation Extractor ---

export const presentationExtractor: TextExtractor<PresentationDocumentSnapshot> = (
  snapshot: PresentationDocumentSnapshot,
) => {
  const parts: string[] = [];

  for (let i = 0; i < snapshot.content.slides.length; i++) {
    const slide = snapshot.content.slides[i];
    parts.push(`Slide ${i + 1}:`);

    for (const element of slide.elements) {
      if (element.content) {
        parts.push(element.content);
      }
      if (element.attrs?.speakerNotes) {
        parts.push(`Notes: ${String(element.attrs.speakerNotes)}`);
      }
    }
  }

  return parts.join('\n');
};

// --- Register built-in extractors ---

registerExtractor('text', textDocumentExtractor);
registerExtractor('spreadsheet', spreadsheetExtractor);
registerExtractor('presentation', presentationExtractor);
