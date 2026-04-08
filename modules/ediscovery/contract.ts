/** Contract: contracts/ediscovery/rules.md */
import { z } from 'zod';

// --- SAR (Subject Access Request) ---

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const SarRequestSchema = z.object({
  userId: z.string().min(1),
});

export type SarRequest = z.infer<typeof SarRequestSchema>;

export const DocumentSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  documentType: z.string(),
  role: z.string(),
  createdAt: z.string(),
});

export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

export const SarExportResultSchema = z.object({
  userId: z.string().min(1),
  documents: z.array(DocumentSummarySchema),
  auditEvents: z.array(z.record(z.unknown())),
  signatureCount: z.number().int().nonnegative(),
  exportedAt: z.string().regex(isoDateRegex),
});

export type SarExportResult = z.infer<typeof SarExportResultSchema>;

// --- FOIA Export ---

export const FoiaRequestSchema = z.object({
  documentId: z.string().min(1),
  startDate: z.string().regex(isoDateRegex).optional(),
  endDate: z.string().regex(isoDateRegex).optional(),
});

export type FoiaRequest = z.infer<typeof FoiaRequestSchema>;

export const VersionSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  versionNumber: z.number().int(),
  createdBy: z.string(),
  createdAt: z.string(),
});

export type VersionSummary = z.infer<typeof VersionSummarySchema>;

export const FoiaExportResultSchema = z.object({
  documentId: z.string().min(1),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  auditTrail: z.array(z.record(z.unknown())),
  versions: z.array(VersionSummarySchema),
  signatureVerification: z.record(z.unknown()).nullable(),
  exportedAt: z.string().regex(isoDateRegex),
});

export type FoiaExportResult = z.infer<typeof FoiaExportResultSchema>;

// --- Export Format ---

export const ExportFormatSchema = z.enum(['json', 'csv', 'pdf']);

export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export type ExportBundle = {
  format: ExportFormat;
  filename: string;
  contentType: string;
  data: Buffer | string;
};

// --- Module Interface ---

export interface EDiscoveryModule {
  sarExport(request: SarRequest): Promise<SarExportResult>;
  foiaExport(request: FoiaRequest): Promise<FoiaExportResult>;
  formatExport(result: SarExportResult | FoiaExportResult, format: ExportFormat, type: 'sar' | 'foia'): ExportBundle;
}
