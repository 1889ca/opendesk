/** Contract: contracts/document/rules.md */
import { z } from 'zod';

// --- Schema Versioning ---

export const PresentationSchemaVersion = {
  V1: '1.0.0',
  current: '1.0.0',
} as const;

export type PresentationSchemaVersion =
  (typeof PresentationSchemaVersion)[keyof Omit<typeof PresentationSchemaVersion, 'current'>];

export const PresentationSchemaVersionSchema = z.enum(['1.0.0']);

// --- Slide / Element Types ---

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const elementIdSchema = z.string().regex(uuidv4Regex, 'Must be a valid UUIDv4');

export const SlideLayoutSchema = z.enum(['blank', 'title', 'content', 'two-column']);
export type SlideLayout = z.infer<typeof SlideLayoutSchema>;

export const SlideElementSchema = z.object({
  id: elementIdSchema,
  type: z.enum(['text', 'image', 'shape']),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  content: z.string(),
  attrs: z.record(z.unknown()).optional(),
});

export type SlideElement = z.infer<typeof SlideElementSchema>;

export const SlideSchema = z.object({
  layout: SlideLayoutSchema,
  elements: z.array(SlideElementSchema),
});

export type Slide = z.infer<typeof SlideSchema>;

export const PresentationContentSchema = z.object({
  slides: z.array(SlideSchema).min(1),
});

export type PresentationContent = z.infer<typeof PresentationContentSchema>;

// --- PresentationDocumentSnapshot ---

export const PresentationDocumentSnapshotSchema = z.object({
  documentType: z.literal('presentation'),
  schemaVersion: PresentationSchemaVersionSchema,
  content: PresentationContentSchema,
});

export type PresentationDocumentSnapshot = z.infer<typeof PresentationDocumentSnapshotSchema>;

// --- Presentation Intent Actions ---

const slideIndex = z.number().int().nonnegative();

export const InsertSlideIntentSchema = z.object({
  type: z.literal('insert_slide'),
  afterSlide: slideIndex.nullable(),
  layout: SlideLayoutSchema,
});

export const DeleteSlideIntentSchema = z.object({
  type: z.literal('delete_slide'),
  slide: slideIndex,
});

export const ReorderSlidesIntentSchema = z.object({
  type: z.literal('reorder_slides'),
  order: z.array(slideIndex).min(1),
});

export const InsertElementIntentSchema = z.object({
  type: z.literal('insert_element'),
  slide: slideIndex,
  element: SlideElementSchema,
});

export const UpdateElementIntentSchema = z.object({
  type: z.literal('update_element'),
  slide: slideIndex,
  elementId: elementIdSchema,
  updates: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    content: z.string().optional(),
    attrs: z.record(z.unknown()).optional(),
  }),
});

export const DeleteElementIntentSchema = z.object({
  type: z.literal('delete_element'),
  slide: slideIndex,
  elementId: elementIdSchema,
});

export const PresentationIntentActionSchema = z.discriminatedUnion('type', [
  InsertSlideIntentSchema,
  DeleteSlideIntentSchema,
  ReorderSlidesIntentSchema,
  InsertElementIntentSchema,
  UpdateElementIntentSchema,
  DeleteElementIntentSchema,
]);

export type PresentationIntentAction = z.infer<typeof PresentationIntentActionSchema>;
