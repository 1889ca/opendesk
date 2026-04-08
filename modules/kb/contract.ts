/** Contract: contracts/kb/rules.md */
import { z } from 'zod';

// --- Entry Status ---

export const KB_ENTRY_STATUSES = [
  'draft',
  'reviewed',
  'published',
  'deprecated',
] as const;

export const KbEntryStatusSchema = z.enum(KB_ENTRY_STATUSES);
export type KbEntryStatus = z.infer<typeof KbEntryStatusSchema>;

/**
 * Allowed status transitions.
 * Key = current status, Value = set of valid target statuses.
 */
export const STATUS_TRANSITIONS: Record<KbEntryStatus, readonly KbEntryStatus[]> = {
  draft: ['reviewed'],
  reviewed: ['published', 'draft'],
  published: ['deprecated'],
  deprecated: [],
};

// --- KB Entry (full record) ---

export const KbEntrySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string(),
  status: KbEntryStatusSchema,
  version: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KbEntry = z.infer<typeof KbEntrySchema>;

// --- Create Input ---

export const KbEntryCreateInputSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type KbEntryCreateInput = z.infer<typeof KbEntryCreateInputSchema>;

// --- Update Input ---

export const KbEntryUpdateInputSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type KbEntryUpdateInput = z.infer<typeof KbEntryUpdateInputSchema>;

// --- Version Snapshot ---

export const KbEntryVersionSchema = z.object({
  id: z.string().uuid(),
  entryId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  metadata: z.record(z.unknown()),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
});

export type KbEntryVersion = z.infer<typeof KbEntryVersionSchema>;

// --- Version Reference ---

export const KbVersionRefSchema = z.object({
  entryId: z.string().uuid(),
  version: z.union([z.literal('latest'), z.number().int().positive()]),
});

export type KbVersionRef = z.infer<typeof KbVersionRefSchema>;

// --- Resolved Reference ---

export const ResolvedReferenceSchema = z.object({
  entryId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  status: KbEntryStatusSchema,
  resolvedAt: z.string().datetime(),
});

export type ResolvedReference = z.infer<typeof ResolvedReferenceSchema>;
