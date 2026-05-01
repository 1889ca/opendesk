/** Contract: contracts/sharing/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import { createShareLinkService, type ShareLinkService } from './share-links.ts';
import { createInMemoryShareLinkStore, type ShareLinkStore } from './store.ts';

describe('share-links — resolve', () => {
  let store: ShareLinkStore;
  let service: ShareLinkService;
  beforeEach(() => {
    store = createInMemoryShareLinkStore();
    service = createShareLinkService(store);
  });

  it('resolves a valid token and increments redemption count', async () => {
    const { link, wireToken } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
    });

    const result = await service.resolve(wireToken);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link.docId).toBe('doc-1');
      expect(result.link.role).toBe('viewer');
    }

    // Redemption count should have been incremented in the store.
    // DB lookup uses link.token (jti), not wireToken.
    const stored = await store.findByToken(link.token);
    expect(stored?.redemptionCount).toBe(1);
  });

  it('returns not_found for invalid token', async () => {
    const result = await service.resolve('nonexistent-token');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('returns invalid_token for a tampered signed token', async () => {
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

    const origPriv = process.env.SHARE_TOKEN_PRIVATE_KEY;
    const origPub = process.env.SHARE_TOKEN_PUBLIC_KEY;
    process.env.SHARE_TOKEN_PRIVATE_KEY = privPem;
    process.env.SHARE_TOKEN_PUBLIC_KEY = pubPem;

    try {
      const localStore = createInMemoryShareLinkStore();
      const localService = createShareLinkService(localStore);
      const { wireToken } = await localService.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
      });

      // Tamper with the payload portion of the signed token.
      const [payload, sig] = wireToken.split('.');
      const tamperedPayload = payload!.slice(0, -4) + 'XXXX';
      const tamperedToken = tamperedPayload + '.' + sig;

      const result = await localService.resolve(tamperedToken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid_token');
      }
    } finally {
      if (origPriv === undefined) delete process.env.SHARE_TOKEN_PRIVATE_KEY;
      else process.env.SHARE_TOKEN_PRIVATE_KEY = origPriv;
      if (origPub === undefined) delete process.env.SHARE_TOKEN_PUBLIC_KEY;
      else process.env.SHARE_TOKEN_PUBLIC_KEY = origPub;
    }
  });

  it('returns expired for expired token', async () => {
    const { link, wireToken } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
      options: { expiresIn: 1 },
    });

    // Manually set expiresAt to the past via the DB jti key.
    await store.update(link.token, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    const result = await service.resolve(wireToken);
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('returns revoked for revoked token', async () => {
    const { wireToken } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
    });

    await service.revoke(wireToken);
    const result = await service.resolve(wireToken);
    expect(result).toEqual({ ok: false, reason: 'revoked' });
  });

  it('returns exhausted when max redemptions reached', async () => {
    const { wireToken } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
      options: { maxRedemptions: 1 },
    });

    // First redemption succeeds
    const first = await service.resolve(wireToken);
    expect(first.ok).toBe(true);

    // Second fails
    const second = await service.resolve(wireToken);
    expect(second).toEqual({ ok: false, reason: 'exhausted' });
  });

  it('resolves password-protected link with correct password', async () => {
    const { wireToken } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
      options: { password: 'correct-horse' },
    });

    const result = await service.resolve(wireToken, 'correct-horse');
    expect(result.ok).toBe(true);
  }, 15_000);

  it('rejects password-protected link with wrong password', async () => {
    const { wireToken } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
      options: { password: 'correct-horse' },
    });

    const result = await service.resolve(wireToken, 'wrong-password');
    expect(result).toEqual({ ok: false, reason: 'wrong_password' });
  }, 15_000);

  it('rejects password-protected link with no password', async () => {
    const { wireToken } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
      options: { password: 'correct-horse' },
    });

    const result = await service.resolve(wireToken);
    expect(result).toEqual({ ok: false, reason: 'wrong_password' });
  }, 15_000);

  it('resolves a legacy unsigned token (backward compat)', async () => {
    // Simulate a pre-existing legacy opaque UUID token stored directly.
    const legacyToken = 'a'.repeat(64); // 64-char hex, no "."
    await store.save({
      token: legacyToken,
      docId: 'doc-legacy',
      grantorId: 'user-1',
      role: 'viewer',
      redemptionCount: 0,
      revoked: false,
      createdAt: new Date().toISOString(),
    });

    const result = await service.resolve(legacyToken);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link.docId).toBe('doc-legacy');
    }
  });
});

describe('share-links — revoke', () => {
  let store: ShareLinkStore;
  let service: ShareLinkService;
  beforeEach(() => {
    store = createInMemoryShareLinkStore();
    service = createShareLinkService(store);
  });

  it('revokes an existing link', async () => {
    const { link, wireToken } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
    });

    const revoked = await service.revoke(wireToken);
    expect(revoked).toBe(true);

    // Verify via DB jti.
    const stored = await store.findByToken(link.token);
    expect(stored?.revoked).toBe(true);
  });

  it('returns false for non-existent token', async () => {
    const revoked = await service.revoke('nonexistent');
    expect(revoked).toBe(false);
  });
});
