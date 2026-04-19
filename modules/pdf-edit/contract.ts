/** Contract: contracts/pdf-edit/rules.md */
import { z } from 'zod';

export const AnnotationTypeSchema = z.enum([
  'highlight',
  'underline',
  'strike',
  'freehand',
  'text_box',
  'stamp',
  'signature_field',
]);

export type AnnotationType = z.infer<typeof AnnotationTypeSchema>;

export const RectSchema = z.object({
  page: z.number().int().min(0),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export type Rect = z.infer<typeof RectSchema>;

export const AnnotationSchema = z.object({
  id: z.string().min(1),
  type: AnnotationTypeSchema,
  rect: RectSchema,
  author_id: z.string().min(1),
  color: z.string().optional(),
  text: z.string().optional(),
  path: z.array(z.tuple([z.number(), z.number()])).optional(),
  created_at: z.string(),
});

export type Annotation = z.infer<typeof AnnotationSchema>;

export const RedactionSchema = z.object({
  id: z.string().min(1),
  rect: RectSchema,
  author_id: z.string().min(1),
  reason: z.string().optional(),
  created_at: z.string(),
});

export type Redaction = z.infer<typeof RedactionSchema>;

export const PdfAnnotationLayerSchema = z.object({
  document_id: z.string().min(1),
  pdf_storage_key: z.string().min(1),
  annotations: z.array(AnnotationSchema),
  redactions: z.array(RedactionSchema),
  form_fields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  updated_at: z.string(),
});

export type PdfAnnotationLayer = z.infer<typeof PdfAnnotationLayerSchema>;

export interface PdfEditor {
  openLayer(documentId: string): Promise<PdfAnnotationLayer>;
  applyAnnotation(documentId: string, annotation: Annotation): Promise<void>;
  applyRedaction(documentId: string, redaction: Redaction): Promise<void>;
  fillField(documentId: string, fieldName: string, value: string | number | boolean | null): Promise<void>;
  save(documentId: string, opts: { flatten: boolean }): Promise<{ storage_key: string }>;
}

export interface PdfEditModule {
  editor: PdfEditor;
}
