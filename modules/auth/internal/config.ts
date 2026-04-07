/** Contract: contracts/auth/rules.md */
import { loadConfig, type AuthConfig, type AuthMode } from '../../config/index.ts';

export type { AuthMode, AuthConfig };

export function loadAuthConfig(): AuthConfig {
  return loadConfig().auth;
}
