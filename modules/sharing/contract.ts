/** Contract: contracts/sharing/rules.md */
import { z } from 'zod';

// --- Grant Role ---
// Subset of permissions' Role that can be shared (owner is excluded).

export const SHAREABLE_ROLES = ['viewer', 'editor', 'commenter'] as const;

export const GrantRoleSchema = z.enum(SHAREABLE_ROLES);

export type GrantRole = z.infer<typeof GrantRoleSchema>;

// --- Grant Status ---

export const GrantStatusSchema = z.enum(['active', 'pending', 'revoked']);

export type GrantStatus = z.infer<typeof GrantStatusSchema>;

// --- Grant ---

const isoStringSchema = z.string().datetime();

export const GrantSchema = z.object({
  id: z.string().uuid(),
  docId: z.string().min(1),
  grantorId: z.string().min(1),
  granteeId: z.string().min(1),
  role: GrantRoleSchema,
  status: GrantStatusSchema,
  createdAt: isoStringSchema,
  revokedAt: isoStringSchema.optional(),
});

export type Grant = z.infer<typeof GrantSchema>;

// --- Share Link Options ---

export const ShareLinkOptionsSchema = z.object({
  expiresIn: z.number().int().positive().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  password: z.string().min(1).optional(),
});

export type ShareLinkOptions = z.infer<typeof ShareLinkOptionsSchema>;

// --- Share Link ---

export const ShareLinkSchema = z.object({
  token: z.string().min(1),
  docId: z.string().min(1),
  grantorId: z.string().min(1),
  role: GrantRoleSchema,
  expiresAt: isoStringSchema.optional(),
  maxRedemptions: z.number().int().positive().optional(),
  redemptionCount: z.number().int().nonnegative(),
  revoked: z.boolean(),
  passwordHash: z.string().optional(),
  createdAt: isoStringSchema,
});

export type ShareLink = z.infer<typeof ShareLinkSchema>;

// --- Invite Request ---

export const InviteRequestSchema = z.object({
  targetDocId: z.string().min(1),
  email: z.string().email(),
  role: GrantRoleSchema,
});

export type InviteRequest = z.infer<typeof InviteRequestSchema>;

// --- Events ---

export const GrantCreatedEventSchema = z.object({
  type: z.literal('GrantCreated'),
  grant: GrantSchema,
  timestamp: isoStringSchema,
});

export type GrantCreatedEvent = z.infer<typeof GrantCreatedEventSchema>;

export const GrantRevokedEventSchema = z.object({
  type: z.literal('GrantRevoked'),
  grantId: z.string().uuid(),
  docId: z.string().min(1),
  revokedAt: isoStringSchema,
});

export type GrantRevokedEvent = z.infer<typeof GrantRevokedEventSchema>;
