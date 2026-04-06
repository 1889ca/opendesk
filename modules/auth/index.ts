/** Contract: contracts/auth/rules.md */
export {
  // Schemas
  ActorTypeSchema,
  PrincipalSchema,
  ServiceAccountDefSchema,
  ServiceAccountSchema,
  AuthErrorCodeSchema,
  AuthErrorSchema,
  VerificationResultSchema,

  // Types
  type ActorType,
  type Principal,
  type ServiceAccountDef,
  type ServiceAccount,
  type AuthErrorCode,
  type AuthError,
  type VerificationResult,
  type TokenVerifier,
  type ApiKeyVerifier,
  type ServiceAccountManager,
} from './contract.ts';
