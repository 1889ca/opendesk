/** Contract: contracts/document/rules.md */
import { z } from 'zod';

// --- Schema Versioning ---

export const SpreadsheetSchemaVersion = {
  V1: '1.0.0',
  current: '1.0.0',
} as const;

export type SpreadsheetSchemaVersion =
  (typeof SpreadsheetSchemaVersion)[keyof Omit<typeof SpreadsheetSchemaVersion, 'current'>];

export const SpreadsheetSchemaVersionSchema = z.enum(['1.0.0']);

// --- Cell / Sheet Types ---

export const CellSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  formula: z.string().optional(),
  format: z.record(z.unknown()).optional(),
});

export type Cell = z.infer<typeof CellSchema>;

export const ColumnSchema = z.object({
  width: z.number().positive().optional(),
});

export const RowSchema = z.object({
  height: z.number().positive().optional(),
  cells: z.array(CellSchema),
});

export const SheetSchema = z.object({
  name: z.string().min(1),
  columns: z.array(ColumnSchema),
  rows: z.array(RowSchema),
});

export type Sheet = z.infer<typeof SheetSchema>;

export const SpreadsheetContentSchema = z.object({
  sheets: z.array(SheetSchema).min(1),
});

export type SpreadsheetContent = z.infer<typeof SpreadsheetContentSchema>;

// --- SpreadsheetDocumentSnapshot ---

export const SpreadsheetDocumentSnapshotSchema = z.object({
  documentType: z.literal('spreadsheet'),
  schemaVersion: SpreadsheetSchemaVersionSchema,
  content: SpreadsheetContentSchema,
});

export type SpreadsheetDocumentSnapshot = z.infer<typeof SpreadsheetDocumentSnapshotSchema>;

// --- Spreadsheet Intent Actions ---

const sheetIndex = z.number().int().nonnegative();
const rowIndex = z.number().int().nonnegative();
const colIndex = z.number().int().nonnegative();

export const UpdateCellIntentSchema = z.object({
  type: z.literal('update_cell'),
  sheet: sheetIndex,
  row: rowIndex,
  col: colIndex,
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  formula: z.string().optional(),
});

export const InsertRowIntentSchema = z.object({
  type: z.literal('insert_row'),
  sheet: sheetIndex,
  afterRow: rowIndex.nullable(),
});

export const DeleteRowIntentSchema = z.object({
  type: z.literal('delete_row'),
  sheet: sheetIndex,
  row: rowIndex,
});

export const InsertColumnIntentSchema = z.object({
  type: z.literal('insert_column'),
  sheet: sheetIndex,
  afterCol: colIndex.nullable(),
});

export const DeleteColumnIntentSchema = z.object({
  type: z.literal('delete_column'),
  sheet: sheetIndex,
  col: colIndex,
});

export const InsertSheetIntentSchema = z.object({
  type: z.literal('insert_sheet'),
  name: z.string().min(1),
  afterSheet: sheetIndex.nullable(),
});

export const DeleteSheetIntentSchema = z.object({
  type: z.literal('delete_sheet'),
  sheet: sheetIndex,
});

export const RenameSheetIntentSchema = z.object({
  type: z.literal('rename_sheet'),
  sheet: sheetIndex,
  name: z.string().min(1),
});

export const SpreadsheetIntentActionSchema = z.discriminatedUnion('type', [
  UpdateCellIntentSchema,
  InsertRowIntentSchema,
  DeleteRowIntentSchema,
  InsertColumnIntentSchema,
  DeleteColumnIntentSchema,
  InsertSheetIntentSchema,
  DeleteSheetIntentSchema,
  RenameSheetIntentSchema,
]);

export type SpreadsheetIntentAction = z.infer<typeof SpreadsheetIntentActionSchema>;
