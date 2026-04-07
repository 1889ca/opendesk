/** Contract: contracts/config/rules.md */
export { loadConfig } from './internal/loader.ts';

export type {
  AppConfig,
  AuthConfig,
  AuthMode,
  PostgresConfig,
  S3Config,
  RedisConfig,
  CollaboraConfig,
  ServerConfig,
} from './contract.ts';

export {
  AppConfigSchema,
  AuthConfigSchema,
  PostgresConfigSchema,
  S3ConfigSchema,
  RedisConfigSchema,
  CollaboraConfigSchema,
  ServerConfigSchema,
} from './contract.ts';
