/** Contract: contracts/document/rules.md */
import { z } from 'zod';

// --- Re-export text types ---
export {
  TextSchemaVersion,
  TextSchemaVersionSchema,
  MarkSchema,
  ProseMirrorNodeSchema,
  ProseMirrorJSONSchema,
  TextDocumentSnapshotSchema,
  MarkSpecSchema,
  InsertBlockIntentSchema,
  UpdateBlockIntentSchema,
  DeleteBlockIntentSchema,
  UpdateMarksIntentSchema,
  TextIntentActionSchema,
} from './text.ts';

export type {
  ProseMirrorNode,
  ProseMirrorJSON,
  TextDocumentSnapshot,
  MarkSpec,
  TextIntentAction,
} from './text.ts';

// --- Re-export spreadsheet types ---
export {
  SpreadsheetSchemaVersion,
  SpreadsheetSchemaVersionSchema,
  CellSchema,
  ColumnSchema,
  RowSchema,
  SheetSchema,
  SpreadsheetContentSchema,
  SpreadsheetDocumentSnapshotSchema,
  UpdateCellIntentSchema,
  InsertRowIntentSchema,
  DeleteRowIntentSchema,
  InsertColumnIntentSchema,
  DeleteColumnIntentSchema,
  InsertSheetIntentSchema,
  DeleteSheetIntentSchema,
  RenameSheetIntentSchema,
  SpreadsheetIntentActionSchema,
} from './spreadsheet.ts';

export type {
  Cell,
  Sheet,
  SpreadsheetContent,
  SpreadsheetDocumentSnapshot,
  SpreadsheetIntentAction,
} from './spreadsheet.ts';

// --- Re-export presentation types ---
export {
  PresentationSchemaVersion,
  PresentationSchemaVersionSchema,
  SlideLayoutSchema,
  SlideElementSchema,
  SlideSchema,
  PresentationContentSchema,
  PresentationDocumentSnapshotSchema,
  InsertSlideIntentSchema,
  DeleteSlideIntentSchema,
  ReorderSlidesIntentSchema,
  InsertElementIntentSchema,
  UpdateElementIntentSchema,
  DeleteElementIntentSchema,
  PresentationIntentActionSchema,
} from './presentation.ts';

export type {
  SlideLayout,
  SlideElement,
  Slide,
  PresentationContent,
  PresentationDocumentSnapshot,
  PresentationIntentAction,
} from './presentation.ts';

// --- Unified DocumentSnapshot ---

import { TextDocumentSnapshotSchema } from './text.ts';
import { SpreadsheetDocumentSnapshotSchema } from './spreadsheet.ts';
import { PresentationDocumentSnapshotSchema } from './presentation.ts';
import { TextIntentActionSchema } from './text.ts';
import { SpreadsheetIntentActionSchema } from './spreadsheet.ts';
import { PresentationIntentActionSchema } from './presentation.ts';

export const DocumentSnapshotSchema = z.discriminatedUnion('documentType', [
  TextDocumentSnapshotSchema,
  SpreadsheetDocumentSnapshotSchema,
  PresentationDocumentSnapshotSchema,
]);

export type DocumentSnapshot = z.infer<typeof DocumentSnapshotSchema>;

// --- Unified IntentAction ---

export const IntentActionSchema = z.discriminatedUnion('type', [
  // Text
  ...TextIntentActionSchema.options,
  // Spreadsheet
  ...SpreadsheetIntentActionSchema.options,
  // Presentation
  ...PresentationIntentActionSchema.options,
]);

export type IntentAction = z.infer<typeof IntentActionSchema>;

// --- RevisionId ---

export type RevisionId = string;

export const RevisionIdSchema = z.string().regex(/^[0-9a-f]{64}$/, 'Must be a SHA-256 hex string');

// --- DocumentIntent ---

export const DocumentIntentSchema = z.object({
  idempotencyKey: z.string().uuid(),
  baseRevision: RevisionIdSchema,
  actorId: z.string().min(1),
  actorType: z.enum(['human', 'agent', 'system']),
  documentId: z.string().min(1),
  action: IntentActionSchema,
});

export type DocumentIntent = z.infer<typeof DocumentIntentSchema>;

// --- Migration (generic) ---

export type Migration<T> = {
  from: string;
  to: string;
  up: (snapshot: T) => T;
};
