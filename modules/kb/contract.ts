/** Contract: contracts/kb/rules.md */
import { z } from 'zod';

// --- Entity Subtypes ---

export const ENTITY_SUBTYPES = ['person', 'organization', 'project', 'term'] as const;

export const EntitySubtypeSchema = z.enum(ENTITY_SUBTYPES);

export type EntitySubtype = z.infer<typeof EntitySubtypeSchema>;

// --- Subtype-specific content schemas ---

export const PersonContentSchema = z.object({
  role: z.string().max(200).optional(),
  email: z.string().email().max(300).optional(),
  organizationId: z.string().uuid().optional(),
  bio: z.string().max(2000).optional(),
});

export type PersonContent = z.infer<typeof PersonContentSchema>;

export const OrganizationContentSchema = z.object({
  orgType: z.enum(['company', 'government', 'ngo', 'academic']).optional(),
  website: z.string().url().max(2000).optional(),
  description: z.string().max(2000).optional(),
});

export type OrganizationContent = z.infer<typeof OrganizationContentSchema>;

export const ProjectContentSchema = z.object({
  status: z.enum(['active', 'completed', 'planned']).optional(),
  description: z.string().max(2000).optional(),
  leadId: z.string().uuid().optional(),
});

export type ProjectContent = z.infer<typeof ProjectContentSchema>;

export const TermContentSchema = z.object({
  definition: z.string().max(4000).optional(),
  domain: z.string().max(200).optional(),
  relatedTerms: z.array(z.string()).default([]),
});

export type TermContent = z.infer<typeof TermContentSchema>;

/** Discriminated content schema based on subtype. */
export function contentSchemaForSubtype(subtype: EntitySubtype) {
  switch (subtype) {
    case 'person': return PersonContentSchema;
    case 'organization': return OrganizationContentSchema;
    case 'project': return ProjectContentSchema;
    case 'term': return TermContentSchema;
  }
}

// --- KBEntity (full record) ---

export const KBEntitySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  subtype: EntitySubtypeSchema,
  name: z.string().min(1).max(200),
  content: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KBEntity = z.infer<typeof KBEntitySchema>;

// --- KBEntitySummary (lightweight for pickers) ---

export const KBEntitySummarySchema = z.object({
  id: z.string().uuid(),
  subtype: EntitySubtypeSchema,
  name: z.string(),
});

export type KBEntitySummary = z.infer<typeof KBEntitySummarySchema>;

// --- Create Input ---

export const EntityCreateInputSchema = z.object({
  name: z.string().min(1).max(200),
  subtype: EntitySubtypeSchema,
  content: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
});

export type EntityCreateInput = z.infer<typeof EntityCreateInputSchema>;

// --- Update Input ---

export const EntityUpdateInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subtype: EntitySubtypeSchema.optional(),
  content: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type EntityUpdateInput = z.infer<typeof EntityUpdateInputSchema>;
