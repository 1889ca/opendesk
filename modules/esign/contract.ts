/** Contract: contracts/esign/rules.md */
import { z } from 'zod';

export const SignerSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  principal_id: z.string().nullable(),
  role: z.enum(['signer', 'witness', 'cc']).default('signer'),
  order: z.number().int().min(0),
});

export type Signer = z.infer<typeof SignerSchema>;

export const PacketStatusSchema = z.enum([
  'draft',
  'awaiting_signers',
  'completed',
  'revoked',
  'expired',
]);

export type PacketStatus = z.infer<typeof PacketStatusSchema>;

export const SigningPacketSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  document_id: z.string().min(1),
  signers: z.array(SignerSchema).min(1),
  sequential: z.boolean().default(true),
  expiration: z.string().nullable(),
  status: PacketStatusSchema,
  created_by: z.string().min(1),
  created_at: z.string(),
});

export type SigningPacket = z.infer<typeof SigningPacketSchema>;

export const CeremonyStepTypeSchema = z.enum([
  'invite_sent',
  'invite_opened',
  'identity_challenge',
  'intent_affirmed',
  'signature_applied',
  'tsa_timestamp',
  'packet_completed',
  'packet_revoked',
  'packet_expired',
]);

export type CeremonyStepType = z.infer<typeof CeremonyStepTypeSchema>;

export const CeremonyStepSchema = z.object({
  id: z.string().min(1),
  packet_id: z.string().min(1),
  signer_id: z.string().nullable(),
  type: CeremonyStepTypeSchema,
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
  payload: z.record(z.unknown()).default({}),
  created_at: z.string(),
  prev_hmac: z.string().nullable(),
  row_hmac: z.string(),
});

export type CeremonyStep = z.infer<typeof CeremonyStepSchema>;

export interface EsignStore {
  createPacket(input: Omit<SigningPacket, 'id' | 'status' | 'created_at'>): Promise<SigningPacket>;
  getPacket(id: string): Promise<SigningPacket | null>;
  recordCeremonyStep(input: Omit<CeremonyStep, 'id' | 'created_at' | 'prev_hmac' | 'row_hmac'>): Promise<CeremonyStep>;
  getAuditTrail(packetId: string): Promise<CeremonyStep[]>;
  markCompleted(id: string): Promise<void>;
  revoke(id: string, by: string): Promise<void>;
}

export interface EsignModule {
  store: EsignStore;
}
