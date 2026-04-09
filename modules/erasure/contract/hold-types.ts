/** Contract: contracts/erasure/rules.md */
import { z } from 'zod';
import { LegalBasisSchema, JurisdictionSchema } from './bridge-types.ts';

// Legal holds (litigation, regulatory, e-discovery) and the
// jurisdiction policy table that maps {jurisdiction, legalBasis} to
// erasure deadlines. Holds block erasures from running until they
// are explicitly released.

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// --- Legal Hold ---

export const HoldType = {
  litigation: 'litigation',
  regulatory: 'regulatory',
  ediscovery: 'ediscovery',
} as const;

export type HoldType = (typeof HoldType)[keyof typeof HoldType];

export const LegalHoldSchema = z.object({
  id: z.string().regex(uuidv4Regex),
  documentId: z.string().min(1),
  holdType: z.enum(['litigation', 'regulatory', 'ediscovery']),
  authority: z.string().min(1),
  reason: z.string().nullable(),
  actorId: z.string().min(1),
  startedAt: z.string().regex(isoDateRegex),
  expiresAt: z.string().regex(isoDateRegex).nullable(),
  releasedAt: z.string().regex(isoDateRegex).nullable(),
  releasedBy: z.string().nullable(),
});

export type LegalHold = z.infer<typeof LegalHoldSchema>;

// --- Erasure Conflict ---

export const ConflictType = {
  LEGAL_HOLD: 'LEGAL_HOLD',
  ACTIVE_EDISCOVERY: 'ACTIVE_EDISCOVERY',
  REGULATORY_FILING: 'REGULATORY_FILING',
} as const;

export type ConflictType = (typeof ConflictType)[keyof typeof ConflictType];

export const ErasureConflictSchema = z.object({
  type: z.enum(['LEGAL_HOLD', 'ACTIVE_EDISCOVERY', 'REGULATORY_FILING']),
  holdId: z.string().regex(uuidv4Regex),
  authority: z.string().min(1),
  blocking: z.boolean(),
  message: z.string(),
});

export type ErasureConflict = z.infer<typeof ErasureConflictSchema>;

// --- Jurisdiction Policy ---

export const JurisdictionPolicySchema = z.object({
  jurisdiction: JurisdictionSchema,
  legalBasis: LegalBasisSchema,
  erasureDeadlineDays: z.number().int().positive(),
  description: z.string(),
});

export type JurisdictionPolicy = z.infer<typeof JurisdictionPolicySchema>;
