/** Contract: contracts/auth/rules.md */
import { z } from 'zod';

// --- Actor Types ---

export const ActorTypeSchema = z.enum(['human', 'agent', 'system']);

export type ActorType = z.infer<typeof ActorTypeSchema>;

// --- Principal ---

export const PrincipalSchema = z.object({
  id: z.string().min(1),
  actorType: ActorTypeSchema,
  displayName: z.string().min(1),
  email: z.string().email().optional(),
  /**
   * Whether the IdP has verified that the user owns the email address.
   * Set from the OIDC `email_verified` claim. Absent means unverified.
   * MUST be checked before trusting email-based lookups (e.g. pending grants).
   */
  emailVerified: z.boolean().optional(),
  scopes: z.array(z.string()),
});

export type Principal = z.infer<typeof PrincipalSchema>;

// --- Service Account ---

export const ServiceAccountDefSchema = z.object({
  displayName: z.string().min(1),
  scopes: z.array(z.string()),
});

export type ServiceAccountDef = z.infer<typeof ServiceAccountDefSchema>;

export const ServiceAccountSchema = z.object({
  id: z.string().min(1),
  apiKey: z.string().min(1),
  displayName: z.string().min(1),
  scopes: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export type ServiceAccount = z.infer<typeof ServiceAccountSchema>;

// --- Auth Errors ---

export const AuthErrorCodeSchema = z.enum([
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'TOKEN_MALFORMED',
  'KEY_INVALID',
  'KEY_REVOKED',
  'PROVIDER_UNREACHABLE',
]);

export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;

export const AuthErrorSchema = z.object({
  code: AuthErrorCodeSchema,
  message: z.string().min(1),
});

export type AuthError = z.infer<typeof AuthErrorSchema>;

// --- Verification Result ---

export const VerificationResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), principal: PrincipalSchema }),
  z.object({ ok: z.literal(false), error: AuthErrorSchema }),
]);

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

// --- Token Verifier Interface ---

export type TokenVerifier = {
  /** Resolve an OIDC/JWT bearer token to a Principal (actorType: 'human'). */
  verifyToken(token: string): Promise<VerificationResult>;
};

// --- API Key Verifier Interface ---

export type ApiKeyVerifier = {
  /** Resolve an API key to a Principal (actorType: 'agent'). */
  verifyApiKey(apiKey: string): Promise<VerificationResult>;
};

// --- Service Account Manager Interface ---

export type ServiceAccountManager = {
  /** Create a service account. Returns the raw API key exactly once. */
  create(def: ServiceAccountDef): Promise<ServiceAccount>;

  /** Read service account metadata by id. Does not return the raw key. */
  read(id: string): Promise<ServiceAccount | null>;

  /** Revoke a service account, invalidating its API key. */
  revoke(id: string): Promise<void>;
};
