/** Contract: contracts/auth/rules.md */

import { describe, it, expect } from 'vitest';
import { createDevTokenVerifier, createDevApiKeyVerifier } from './dev-verifier.ts';

describe('Dev Token Verifier', () => {
  const verifier = createDevTokenVerifier();

  it('accepts bare "dev" token as default user', async () => {
    const result = await verifier.verifyToken('dev');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.actorType).toBe('human');
    expect(result.principal.id).toBe('dev-user');
    expect(result.principal.scopes).toContain('*');
  });

  it('accepts dev:<id>:<name>:<scopes> format', async () => {
    const result = await verifier.verifyToken('dev:u42:Alice:read,write');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.id).toBe('u42');
    expect(result.principal.actorType).toBe('human');
    expect(result.principal.displayName).toBe('Alice');
    expect(result.principal.scopes).toEqual(['read', 'write']);
  });

  it('accepts dev:<id>:<name> without scopes, defaults to *', async () => {
    const result = await verifier.verifyToken('dev:u1:Bob');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.scopes).toEqual(['*']);
  });

  it('rejects empty token', async () => {
    const result = await verifier.verifyToken('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TOKEN_MALFORMED');
  });

  it('rejects non-dev-prefixed token', async () => {
    const result = await verifier.verifyToken('some.jwt.token');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TOKEN_MALFORMED');
  });

  it('rejects dev: with too few parts', async () => {
    const result = await verifier.verifyToken('dev:onlyid');
    expect(result.ok).toBe(false);
  });

  it('always produces actorType "human"', async () => {
    const tokens = ['dev', 'dev:a:A', 'dev:b:B:read'];
    for (const t of tokens) {
      const result = await verifier.verifyToken(t);
      if (result.ok) {
        expect(result.principal.actorType).toBe('human');
      }
    }
  });

  it('same token always resolves to same id (stable identity)', async () => {
    const r1 = await verifier.verifyToken('dev:x:X');
    const r2 = await verifier.verifyToken('dev:x:X');
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.principal.id).toBe(r2.principal.id);
    }
  });
});

describe('Dev API Key Verifier', () => {
  const verifier = createDevApiKeyVerifier();

  it('accepts devkey:<id> format', async () => {
    const result = await verifier.verifyApiKey('devkey:bot1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.actorType).toBe('agent');
    expect(result.principal.id).toBe('agent-bot1');
  });

  it('rejects non-devkey-prefixed key', async () => {
    const result = await verifier.verifyApiKey('randomkey123');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('KEY_INVALID');
  });
});
