/** Contract: contracts/sharing/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import { createShareLinkService, verifyPassword, generateToken, type ShareLinkService } from './share-links.ts';
import { createInMemoryShareLinkStore, type ShareLinkStore } from './store.ts';

describe('share-links — generateToken', () => {
  it('produces 64-char hex string (256 bits)', () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique tokens', () => {
    const tokens = Array.from({ length: 100 }, () => generateToken());
    expect(new Set(tokens).size).toBe(100);
  });
});

describe('share-links — create', () => {
  let store: ShareLinkStore;
  let service: ShareLinkService;
  beforeEach(() => {
    store = createInMemoryShareLinkStore();
    service = createShareLinkService(store);
  });

  it('creates a share link with role and no expiry', async () => {
    const { link, wireToken } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
    });

    // Internal jti is a 64-char hex string; wireToken may be signed or the same jti.
    expect(link.token).toHaveLength(64);
    expect(link.token).toMatch(/^[0-9a-f]{64}$/);
    expect(wireToken).toBeDefined();
    expect(link.docId).toBe('doc-1');
    expect(link.grantorId).toBe('user-1');
    expect(link.role).toBe('viewer');
    expect(link.expiresAt).toBeUndefined();
    expect(link.redemptionCount).toBe(0);
    expect(link.revoked).toBe(false);
  });

  it('creates a share link with expiry', async () => {
    const before = Date.now();
    const { link } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'editor',
      options: { expiresIn: 3600 },
    });

    expect(link.expiresAt).toBeDefined();
    const expiresMs = new Date(link.expiresAt!).getTime();
    // Should expire ~1 hour from now (within 5s tolerance)
    expect(expiresMs).toBeGreaterThanOrEqual(before + 3595_000);
    expect(expiresMs).toBeLessThanOrEqual(before + 3605_000);
  });

  it('creates a password-protected link', async () => {
    const { link } = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
      options: { password: 'secret123' },
    });

    expect(link.passwordHash).toBeDefined();
    // bcrypt hash should verify against the original password
    const matches = await verifyPassword('secret123', link.passwordHash!);
    expect(matches).toBe(true);
  }, 15_000);

  it('wireToken is a signed token when SHARE_TOKEN_PRIVATE_KEY is set', async () => {
    // Import key generation helpers directly since we need a real key pair.
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

    const originalPriv = process.env.SHARE_TOKEN_PRIVATE_KEY;
    const originalPub = process.env.SHARE_TOKEN_PUBLIC_KEY;
    process.env.SHARE_TOKEN_PRIVATE_KEY = privPem;
    process.env.SHARE_TOKEN_PUBLIC_KEY = pubPem;

    try {
      const localStore = createInMemoryShareLinkStore();
      const localService = createShareLinkService(localStore);
      const { link, wireToken } = await localService.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
      });

      // A signed token contains a "." separator.
      expect(wireToken).toContain('.');

      // Resolving with the wireToken should succeed.
      const result = await localService.resolve(wireToken);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.link.docId).toBe('doc-1');
        expect(result.link.role).toBe('viewer');
      }

      // The internal jti is the DB key, not the wire token.
      expect(link.token).not.toContain('.');
    } finally {
      if (originalPriv === undefined) {
        delete process.env.SHARE_TOKEN_PRIVATE_KEY;
      } else {
        process.env.SHARE_TOKEN_PRIVATE_KEY = originalPriv;
      }
      if (originalPub === undefined) {
        delete process.env.SHARE_TOKEN_PUBLIC_KEY;
      } else {
        process.env.SHARE_TOKEN_PUBLIC_KEY = originalPub;
      }
    }
  });

  it('wireToken falls back to jti when no key is configured', async () => {
    const originalPriv = process.env.SHARE_TOKEN_PRIVATE_KEY;
    delete process.env.SHARE_TOKEN_PRIVATE_KEY;

    try {
      const localStore = createInMemoryShareLinkStore();
      const localService = createShareLinkService(localStore);
      const { link, wireToken } = await localService.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
      });

      // Without a key, wireToken == jti (the raw 64-char hex).
      expect(wireToken).toBe(link.token);
    } finally {
      if (originalPriv === undefined) {
        delete process.env.SHARE_TOKEN_PRIVATE_KEY;
      } else {
        process.env.SHARE_TOKEN_PRIVATE_KEY = originalPriv;
      }
    }
  });
});
