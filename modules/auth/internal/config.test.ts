/** Contract: contracts/auth/rules.md */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadAuthConfig } from './config.ts';

describe('loadAuthConfig', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AUTH_MODE;
    delete process.env.OIDC_ISSUER;
    delete process.env.OIDC_CLIENT_ID;
    delete process.env.OIDC_AUDIENCE;
  });

  afterEach(() => {
    Object.assign(process.env, origEnv);
  });

  it('defaults to oidc mode', () => {
    const cfg = loadAuthConfig();
    expect(cfg.mode).toBe('oidc');
  });

  it('reads dev mode from AUTH_MODE', () => {
    process.env.AUTH_MODE = 'dev';
    const cfg = loadAuthConfig();
    expect(cfg.mode).toBe('dev');
  });

  it('reads OIDC settings from env', () => {
    process.env.OIDC_ISSUER = 'https://auth.example.com';
    process.env.OIDC_CLIENT_ID = 'my-client';
    process.env.OIDC_AUDIENCE = 'my-audience';
    const cfg = loadAuthConfig();
    expect(cfg.oidcIssuer).toBe('https://auth.example.com');
    expect(cfg.oidcClientId).toBe('my-client');
    expect(cfg.oidcAudience).toBe('my-audience');
  });

  it('defaults audience to clientId', () => {
    process.env.OIDC_CLIENT_ID = 'client-x';
    const cfg = loadAuthConfig();
    expect(cfg.oidcAudience).toBe('client-x');
  });

  it('throws on invalid AUTH_MODE', () => {
    process.env.AUTH_MODE = 'invalid';
    expect(() => loadAuthConfig()).toThrow();
  });
});
