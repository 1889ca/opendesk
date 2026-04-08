/** Contract: contracts/convert/rules.md */
import { z } from 'zod';

// --- Format Enums ---

export const ImportFormatSchema = z.enum(['docx', 'odt', 'pdf', 'pptx', 'odp']);

export type ImportFormat = z.infer<typeof ImportFormatSchema>;

export const ExportFormatSchema = z.enum(['docx', 'odt', 'pdf', 'pptx', 'odp']);

export type ExportFormat = z.infer<typeof ExportFormatSchema>;

// --- Conversion Request ---

export const ConversionRequestSchema = z.discriminatedUnion('direction', [
  z.object({
    direction: z.literal('import'),
    format: ImportFormatSchema,
    documentId: z.string().min(1),
  }),
  z.object({
    direction: z.literal('export'),
    format: ExportFormatSchema,
    documentId: z.string().min(1),
    requestedBy: z.string().min(1),
  }),
]);

export type ConversionRequest = z.infer<typeof ConversionRequestSchema>;

// --- Conversion Result (Export) ---

const isoStringSchema = z.string().datetime();

export const ConversionResultSchema = z.object({
  documentId: z.string().min(1),
  format: ExportFormatSchema,
  stale: z.boolean(),
  exportedAt: isoStringSchema,
});

export type ConversionResult = z.infer<typeof ConversionResultSchema>;

// --- Events ---

export const ConversionRequestedEventSchema = z.object({
  type: z.literal('ConversionRequested'),
  documentId: z.string().min(1),
  format: ExportFormatSchema,
  requestedBy: z.string().min(1),
  timestamp: isoStringSchema,
});

export type ConversionRequestedEvent = z.infer<typeof ConversionRequestedEventSchema>;

export const ExportReadyEventSchema = z.object({
  type: z.literal('ExportReady'),
  documentId: z.string().min(1),
  format: ExportFormatSchema,
  stale: z.boolean(),
  timestamp: isoStringSchema,
});

export type ExportReadyEvent = z.infer<typeof ExportReadyEventSchema>;

// --- Flush Config ---

export const FlushConfigSchema = z.object({
  timeoutMs: z.number().int().positive().default(10_000),
});

export type FlushConfig = z.infer<typeof FlushConfigSchema>;
