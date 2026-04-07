/** Contract: contracts/references/rules.md */
import { z } from 'zod';

// --- Author ---

export const AuthorSchema = z.object({
  given: z.string().optional(),
  family: z.string().optional(),
  literal: z.string().optional(),
});

export type Author = z.infer<typeof AuthorSchema>;

// --- Reference Type ---

export const REFERENCE_TYPES = [
  'article-journal',
  'book',
  'chapter',
  'webpage',
  'report',
  'thesis',
  'paper-conference',
  'patent',
  'legislation',
  'dataset',
  'software',
  'personal-communication',
  'interview',
  'motion-picture',
  'broadcast',
  'other',
] as const;

export const ReferenceTypeSchema = z.enum(REFERENCE_TYPES);

export type ReferenceType = z.infer<typeof ReferenceTypeSchema>;

// --- Reference (full record) ---

export const ReferenceSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  type: ReferenceTypeSchema,
  title: z.string().min(1),
  authors: z.array(AuthorSchema),
  issuedDate: z.string().nullable().optional(),
  containerTitle: z.string().nullable().optional(),
  volume: z.string().nullable().optional(),
  issue: z.string().nullable().optional(),
  pages: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  isbn: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  language: z.string().default('en'),
  customFields: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Reference = z.infer<typeof ReferenceSchema>;

// --- Create Input ---

export const ReferenceCreateInputSchema = z.object({
  title: z.string().min(1),
  authors: z.array(AuthorSchema).default([]),
  type: ReferenceTypeSchema.default('article-journal'),
  issuedDate: z.string().nullable().optional(),
  containerTitle: z.string().nullable().optional(),
  volume: z.string().nullable().optional(),
  issue: z.string().nullable().optional(),
  pages: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  isbn: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  language: z.string().default('en'),
  customFields: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
});

export type ReferenceCreateInput = z.infer<typeof ReferenceCreateInputSchema>;

// --- Update Input (all fields optional) ---

export const ReferenceUpdateInputSchema = z.object({
  title: z.string().min(1).optional(),
  authors: z.array(AuthorSchema).optional(),
  type: ReferenceTypeSchema.optional(),
  issuedDate: z.string().nullable().optional(),
  containerTitle: z.string().nullable().optional(),
  volume: z.string().nullable().optional(),
  issue: z.string().nullable().optional(),
  pages: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  isbn: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  language: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type ReferenceUpdateInput = z.infer<typeof ReferenceUpdateInputSchema>;

// --- Citation Attrs (inline citation mark data) ---

export const CitationAttrsSchema = z.object({
  referenceId: z.string().uuid(),
  locator: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

export type CitationAttrs = z.infer<typeof CitationAttrsSchema>;

// --- Document Citation (join record) ---

export const DocumentCitationSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  referenceId: z.string().uuid(),
  locator: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export type DocumentCitation = z.infer<typeof DocumentCitationSchema>;
