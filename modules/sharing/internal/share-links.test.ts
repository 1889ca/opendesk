/** Contract: contracts/sharing/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import { createShareLinkService, hashPassword, verifyPassword, generateToken, type ShareLinkService } from './share-links.ts';
import { createInMemoryShareLinkStore, type ShareLinkStore } from './store.ts';

describe('share-links', () => {
  let store: ShareLinkStore;
  let service: ShareLinkService;
  beforeEach(() => {
    store = createInMemoryShareLinkStore();
    service = createShareLinkService(store);
  });

  describe('generateToken', () => {
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

  describe('create', () => {
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
    });
  });

  describe('resolve', () => {
    it('resolves a valid token and increments redemption count', async () => {
      const link = await service.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
      });

      const result = await service.resolve(link.token);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.link.docId).toBe('doc-1');
        expect(result.link.role).toBe('viewer');
      }

      // Redemption count should have been incremented in the store
      const stored = await store.findByToken(link.token);
      expect(stored?.redemptionCount).toBe(1);
    });

    it('returns not_found for invalid token', async () => {
      const result = await service.resolve('nonexistent-token');
      expect(result).toEqual({ ok: false, reason: 'not_found' });
    });

    it('returns expired for expired token', async () => {
      const link = await service.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
        options: { expiresIn: 1 },
      });

      // Manually set expiresAt to the past
      await store.update(link.token, {
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      const result = await service.resolve(link.token);
      expect(result).toEqual({ ok: false, reason: 'expired' });
    });

    it('returns revoked for revoked token', async () => {
      const link = await service.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
      });

      await service.revoke(link.token);
      const result = await service.resolve(link.token);
      expect(result).toEqual({ ok: false, reason: 'revoked' });
    });

    it('returns exhausted when max redemptions reached', async () => {
      const link = await service.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
        options: { maxRedemptions: 1 },
      });

      // First redemption succeeds
      const first = await service.resolve(link.token);
      expect(first.ok).toBe(true);

      // Second fails
      const second = await service.resolve(link.token);
      expect(second).toEqual({ ok: false, reason: 'exhausted' });
    });

    it('resolves password-protected link with correct password', async () => {
      const link = await service.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
        options: { password: 'correct-horse' },
      });

      const result = await service.resolve(link.token, 'correct-horse');
      expect(result.ok).toBe(true);
    });

    it('rejects password-protected link with wrong password', async () => {
      const link = await service.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
        options: { password: 'correct-horse' },
      });

      const result = await service.resolve(link.token, 'wrong-password');
      expect(result).toEqual({ ok: false, reason: 'wrong_password' });
    });

    it('rejects password-protected link with no password', async () => {
      const link = await service.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
        options: { password: 'correct-horse' },
      });

      const result = await service.resolve(link.token);
      expect(result).toEqual({ ok: false, reason: 'wrong_password' });
    });
  });

  describe('revoke', () => {
    it('revokes an existing link', async () => {
      const link = await service.create({
        docId: 'doc-1',
        grantorId: 'user-1',
        role: 'viewer',
      });

      const revoked = await service.revoke(link.token);
      expect(revoked).toBe(true);

      const stored = await store.findByToken(link.token);
      expect(stored?.revoked).toBe(true);
    });

    it('returns false for non-existent token', async () => {
      const revoked = await service.revoke('nonexistent');
      expect(revoked).toBe(false);
    });
  });
});
