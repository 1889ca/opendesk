/** Contract: contracts/app-sheets/rules.md */
import { z } from 'zod';

// --- Number Format ---

export const NumberFormatTypeSchema = z.enum([
  'general', 'number', 'currency', 'percentage', 'date',
]);

export type NumberFormatType = z.infer<typeof NumberFormatTypeSchema>;

// --- Cell Format ---

export const CellFormatSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  fontSize: z.number().optional(),
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
  numberFormat: NumberFormatTypeSchema.optional(),
  borderTop: z.boolean().optional(),
  borderBottom: z.boolean().optional(),
  borderLeft: z.boolean().optional(),
  borderRight: z.boolean().optional(),
});

export type CellFormat = z.infer<typeof CellFormatSchema>;

// --- Sheet Meta ---

export const SheetMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export type SheetMeta = z.infer<typeof SheetMetaSchema>;
