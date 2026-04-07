# Config Module Contract

## Purpose

Centralized, Zod-validated configuration loaded once at startup.
All environment variables are validated in one place — modules receive typed config objects.

## Invariants

- All env vars are validated at startup; invalid config crashes immediately with a clear error
- No module reads `process.env` directly — they receive config via dependency injection
- Production mode (`NODE_ENV=production`) enforces required secrets (PG_PASSWORD, S3 keys)
- Dev mode (`AUTH_MODE=dev`) is forbidden in production
- Config is immutable after `loadConfig()` returns

## Public API

- `loadConfig(): AppConfig` — validate all env vars, return frozen config
- `AppConfig` type — full typed config object
- Sub-config types: `AuthConfig`, `PostgresConfig`, `S3Config`, `RedisConfig`, `CollaboraConfig`, `ServerConfig`
