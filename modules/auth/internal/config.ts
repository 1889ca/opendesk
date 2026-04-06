/** Contract: contracts/auth/rules.md */

/**
 * Auth module configuration, driven entirely by environment variables.
 * AUTH_MODE controls which verification strategy is active.
 */

export type AuthMode = 'oidc' | 'dev';

export type AuthConfig = {
  mode: AuthMode;
  /** OIDC issuer URL (e.g. https://keycloak.example.com/realms/opendesk) */
  oidcIssuer: string;
  /** OIDC client ID used for audience validation */
  oidcClientId: string;
  /** Optional: OIDC audience (defaults to clientId) */
  oidcAudience: string;
};

export function loadAuthConfig(): AuthConfig {
  const mode = (process.env.AUTH_MODE || 'oidc') as AuthMode;
  if (mode !== 'oidc' && mode !== 'dev') {
    throw new Error(`Invalid AUTH_MODE: ${mode}. Must be 'oidc' or 'dev'.`);
  }

  return {
    mode,
    oidcIssuer: process.env.OIDC_ISSUER || '',
    oidcClientId: process.env.OIDC_CLIENT_ID || '',
    oidcAudience: process.env.OIDC_AUDIENCE || process.env.OIDC_CLIENT_ID || '',
  };
}
