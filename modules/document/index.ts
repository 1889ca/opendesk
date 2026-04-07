/** Contract: contracts/document/rules.md */

// --- Text ---
export {
  TextSchemaVersion,
  TextSchemaVersionSchema,
  ProseMirrorNodeSchema,
  ProseMirrorJSONSchema,
  MarkSchema,
  TextDocumentSnapshotSchema,
  MarkSpecSchema,
  InsertBlockIntentSchema,
  UpdateBlockIntentSchema,
  DeleteBlockIntentSchema,
  UpdateMarksIntentSchema,
  TextIntentActionSchema,
} from './contract/index.ts';

export type {
  ProseMirrorNode,
  ProseMirrorJSON,
  TextDocumentSnapshot,
  MarkSpec,
  TextIntentAction,
} from './contract/index.ts';

// --- Spreadsheet ---
export {
  SpreadsheetSchemaVersion,
  SpreadsheetSchemaVersionSchema,
  CellSchema,
  SheetSchema,
  SpreadsheetContentSchema,
  SpreadsheetDocumentSnapshotSchema,
  SpreadsheetIntentActionSchema,
} from './contract/index.ts';

export type {
  Cell,
  Sheet,
  SpreadsheetContent,
  SpreadsheetDocumentSnapshot,
  SpreadsheetIntentAction,
} from './contract/index.ts';

// --- Presentation ---
export {
  PresentationSchemaVersion,
  PresentationSchemaVersionSchema,
  SlideElementSchema,
  SlideSchema,
  PresentationContentSchema,
  PresentationDocumentSnapshotSchema,
  PresentationIntentActionSchema,
} from './contract/index.ts';

export type {
  SlideLayout,
  SlideElement,
  Slide,
  PresentationContent,
  PresentationDocumentSnapshot,
  PresentationIntentAction,
} from './contract/index.ts';

// --- Unified ---
export {
  DocumentSnapshotSchema,
  RevisionIdSchema,
  IntentActionSchema,
  DocumentIntentSchema,
} from './contract/index.ts';

export type {
  DocumentSnapshot,
  RevisionId,
  IntentAction,
  DocumentIntent,
  Migration,
} from './contract/index.ts';

// Pure functions
export { migrateToLatest } from './internal/migrations.ts';
export { computeRevisionId } from './internal/revision.ts';
