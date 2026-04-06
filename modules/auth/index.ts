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

export { createAuth, type AuthModule, type AuthDependencies } from './internal/create-auth.ts';
export { createAuthMiddleware, type AuthMiddlewareOptions } from './internal/middleware.ts';
export { createSystemPrincipal } from './internal/system.ts';
export { loadAuthConfig, type AuthConfig, type AuthMode } from './internal/config.ts';
export { createOidcVerifier } from './internal/oidc-verifier.ts';
export { createDevTokenVerifier, createDevApiKeyVerifier } from './internal/dev-verifier.ts';
export { createApiKeyVerifier, type ServiceAccountStore, type ServiceAccountRecord } from './internal/apikey-verifier.ts';
export { createServiceAccountManager, type ServiceAccountStorage } from './internal/service-accounts.ts';
export { hashApiKey, generateApiKey } from './internal/hash.ts';
