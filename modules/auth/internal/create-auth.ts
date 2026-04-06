/** Contract: contracts/auth/rules.md */

import type { TokenVerifier, ApiKeyVerifier, ServiceAccountManager } from '../contract.ts';
import { loadAuthConfig, type AuthConfig } from './config.ts';
import { createOidcVerifier } from './oidc-verifier.ts';
import { createDevTokenVerifier, createDevApiKeyVerifier } from './dev-verifier.ts';
import { createApiKeyVerifier, type ServiceAccountStore } from './apikey-verifier.ts';
import { createServiceAccountManager, type ServiceAccountStorage } from './service-accounts.ts';
import { createAuthMiddleware, type AuthMiddlewareOptions } from './middleware.ts';
import { createSystemPrincipal } from './system.ts';

export type AuthModule = {
  tokenVerifier: TokenVerifier;
  apiKeyVerifier: ApiKeyVerifier;
  serviceAccounts: ServiceAccountManager;
  middleware: ReturnType<typeof createAuthMiddleware>;
  systemPrincipal: ReturnType<typeof createSystemPrincipal>;
  config: AuthConfig;
};

export type AuthDependencies = {
  serviceAccountStore: ServiceAccountStore;
  serviceAccountStorage: ServiceAccountStorage;
  /** Paths that skip authentication */
  publicPaths?: string[];
};

/**
 * Factory function that wires up the entire auth module.
 * Call once at application startup.
 */
export function createAuth(deps: AuthDependencies): AuthModule {
  const config = loadAuthConfig();

  let tokenVerifier: TokenVerifier;
  let apiKeyVerifier: ApiKeyVerifier;

  if (config.mode === 'dev') {
    console.warn('[auth] Running in DEV mode — no real token verification');
    tokenVerifier = createDevTokenVerifier();
    apiKeyVerifier = createDevApiKeyVerifier();
  } else {
    if (!config.oidcIssuer) {
      throw new Error('OIDC_ISSUER is required when AUTH_MODE is not "dev"');
    }
    if (!config.oidcClientId) {
      throw new Error('OIDC_CLIENT_ID is required when AUTH_MODE is not "dev"');
    }
    tokenVerifier = createOidcVerifier(config);
    apiKeyVerifier = createApiKeyVerifier(deps.serviceAccountStore);
  }

  const serviceAccounts = createServiceAccountManager(deps.serviceAccountStorage);

  const middlewareOpts: AuthMiddlewareOptions = {
    tokenVerifier,
    apiKeyVerifier,
    publicPaths: deps.publicPaths,
  };

  return {
    tokenVerifier,
    apiKeyVerifier,
    serviceAccounts,
    middleware: createAuthMiddleware(middlewareOpts),
    systemPrincipal: createSystemPrincipal(),
    config,
  };
}
