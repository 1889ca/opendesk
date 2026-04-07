/** Contract: contracts/sharing/rules.md */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { ShareLink, ShareLinkOptions, GrantRole } from '../contract.ts';
import type { ShareLinkStore } from './store.ts';

const BCRYPT_ROUNDS = 12;

/** Hash a password with bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compare a plaintext password against a bcrypt hash (timing-safe). */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Generate a cryptographically random token (256 bits / 32 bytes). */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export interface CreateShareLinkInput {
  docId: string;
  grantorId: string;
  role: GrantRole;
  options?: ShareLinkOptions;
}

export interface ShareLinkService {
  create(input: CreateShareLinkInput): Promise<ShareLink>;
  resolve(token: string, password?: string): Promise<ShareLinkResult>;
  revoke(token: string): Promise<boolean>;
}

export type ShareLinkResult =
  | { ok: true; link: ShareLink }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' | 'exhausted' | 'wrong_password' };

export function createShareLinkService(store: ShareLinkStore): ShareLinkService {
  return {
    async create(input) {
      const now = new Date().toISOString();
      const expiresAt = input.options?.expiresIn
        ? new Date(Date.now() + input.options.expiresIn * 1000).toISOString()
        : undefined;

      const passwordHash = input.options?.password
        ? await hashPassword(input.options.password)
        : undefined;

      const link: ShareLink = {
        token: generateToken(),
        docId: input.docId,
        grantorId: input.grantorId,
        role: input.role,
        expiresAt,
        maxRedemptions: input.options?.maxRedemptions,
        redemptionCount: 0,
        revoked: false,
        passwordHash,
        createdAt: now,
      };

      await store.save(link);
      return link;
    },

    async resolve(token, password) {
      const link = await store.findByToken(token);
      if (!link) return { ok: false, reason: 'not_found' };
      if (link.revoked) return { ok: false, reason: 'revoked' };

      if (link.expiresAt && new Date(link.expiresAt) <= new Date()) {
        return { ok: false, reason: 'expired' };
      }

      if (link.maxRedemptions && link.redemptionCount >= link.maxRedemptions) {
        return { ok: false, reason: 'exhausted' };
      }

      if (link.passwordHash) {
        if (!password) return { ok: false, reason: 'wrong_password' };
        const valid = await verifyPassword(password, link.passwordHash);
        if (!valid) return { ok: false, reason: 'wrong_password' };
      }

      await store.update(token, { redemptionCount: link.redemptionCount + 1 });
      return { ok: true, link };
    },

    async revoke(token) {
      const link = await store.findByToken(token);
      if (!link) return false;
      await store.update(token, { revoked: true });
      return true;
    },
  };
}
