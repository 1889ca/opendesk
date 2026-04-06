/** Contract: contracts/document/rules.md */
import { z } from 'zod';

// --- Schema Versioning ---

export const TextSchemaVersion = {
  V1: '1.0.0',
  current: '1.0.0',
} as const;

export type TextSchemaVersion = (typeof TextSchemaVersion)[keyof Omit<typeof TextSchemaVersion, 'current'>];

export const TextSchemaVersionSchema = z.enum(['1.0.0']);

// --- ProseMirror JSON ---

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MarkSchema = z.object({
  type: z.string().min(1),
  attrs: z.record(z.unknown()).optional(),
});

export const ProseMirrorNodeSchema: z.ZodType<ProseMirrorNode> = z.lazy(() =>
  z.object({
    type: z.string().min(1),
    attrs: z.record(z.unknown()).optional(),
    content: z.array(ProseMirrorNodeSchema).optional(),
    marks: z.array(MarkSchema).optional(),
    text: z.string().optional(),
  })
);

export type ProseMirrorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

export const ProseMirrorJSONSchema = z.object({
  type: z.literal('doc'),
  content: z.array(
    ProseMirrorNodeSchema.refine(
      (node) => node.attrs?.blockId && uuidv4Regex.test(String(node.attrs.blockId)),
      { message: 'Top-level content nodes must have a valid UUIDv4 blockId in attrs' }
    )
  ),
});

export type ProseMirrorJSON = z.infer<typeof ProseMirrorJSONSchema>;

// --- DocumentSnapshot ---

export const TextDocumentSnapshotSchema = z.object({
  documentType: z.literal('text'),
  schemaVersion: TextSchemaVersionSchema,
  content: ProseMirrorJSONSchema,
});

export type TextDocumentSnapshot = z.infer<typeof TextDocumentSnapshotSchema>;

export const DocumentSnapshotSchema = z.discriminatedUnion('documentType', [
  TextDocumentSnapshotSchema,
]);

export type DocumentSnapshot = z.infer<typeof DocumentSnapshotSchema>;

// --- RevisionId ---

export type RevisionId = string;

export const RevisionIdSchema = z.string().regex(/^[0-9a-f]{64}$/, 'Must be a SHA-256 hex string');

// --- DocumentIntent ---

export const MarkSpecSchema = z.object({
  type: z.string().min(1),
  attrs: z.record(z.unknown()).optional(),
});

export type MarkSpec = z.infer<typeof MarkSpecSchema>;

const blockIdSchema = z.string().regex(uuidv4Regex, 'Must be a valid UUIDv4');

export const InsertBlockIntentSchema = z.object({
  type: z.literal('insert_block'),
  afterBlockId: blockIdSchema.nullable(),
  blockType: z.string().min(1),
  content: z.string(),
  attrs: z.record(z.unknown()).optional(),
});

export const UpdateBlockIntentSchema = z.object({
  type: z.literal('update_block'),
  blockId: blockIdSchema,
  content: z.string(),
});

export const DeleteBlockIntentSchema = z.object({
  type: z.literal('delete_block'),
  blockId: blockIdSchema,
});

export const UpdateMarksIntentSchema = z.object({
  type: z.literal('update_marks'),
  blockId: blockIdSchema,
  range: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  }).refine((r) => r.start < r.end, { message: 'range.start must be less than range.end' }),
  marks: z.array(MarkSpecSchema).min(1),
  action: z.enum(['add', 'remove']),
});

export const IntentActionSchema = z.discriminatedUnion('type', [
  InsertBlockIntentSchema,
  UpdateBlockIntentSchema,
  DeleteBlockIntentSchema,
  UpdateMarksIntentSchema,
]);

export type IntentAction = z.infer<typeof IntentActionSchema>;

export const DocumentIntentSchema = z.object({
  idempotencyKey: z.string().uuid(),
  baseRevision: RevisionIdSchema,
  actorId: z.string().min(1),
  actorType: z.enum(['human', 'agent', 'system']),
  documentId: z.string().min(1),
  action: IntentActionSchema,
});

export type DocumentIntent = z.infer<typeof DocumentIntentSchema>;

// --- Migration ---

export type Migration = {
  from: TextSchemaVersion;
  to: TextSchemaVersion;
  up: (snapshot: TextDocumentSnapshot) => TextDocumentSnapshot;
};
