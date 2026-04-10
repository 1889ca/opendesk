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
    const link = await service.create({
      docId: 'doc-1',
      grantorId: 'user-1',
      role: 'viewer',
    });

    expect(link.token).toHaveLength(64);
    expect(link.docId).toBe('doc-1');
    expect(link.grantorId).toBe('user-1');
    expect(link.role).toBe('viewer');
    expect(link.expiresAt).toBeUndefined();
    expect(link.redemptionCount).toBe(0);
    expect(link.revoked).toBe(false);
  });

  it('creates a share link with expiry', async () => {
    const before = Date.now();
    const link = await service.create({
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
    const link = await service.create({
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
});
