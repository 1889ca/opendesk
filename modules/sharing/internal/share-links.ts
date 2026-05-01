/** Contract: contracts/sharing/rules.md */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { ShareLink, ShareLinkOptions, GrantRole } from '../contract.ts';
import type { ShareLinkStore } from './store.ts';
import { signToken, verifyToken, isSignedToken } from './signed-token.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('sharing:share-links');
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
  /** Optional: restrict redemption to a specific recipient user ID. */
  recipientId?: string;
}

export interface ShareLinkService {
  create(input: CreateShareLinkInput): Promise<{ link: ShareLink; wireToken: string }>;
  resolve(token: string, password?: string, options?: ResolveOptions): Promise<ShareLinkResult>;
  revoke(token: string): Promise<boolean>;
  getByToken(token: string): Promise<ShareLink | null>;
}

export interface ResolveOptions {
  /** When true, skip incrementing the redemption counter. */
  skipIncrement?: boolean;
}

export type ShareLinkResult =
  | { ok: true; link: ShareLink }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' | 'exhausted' | 'wrong_password' | 'invalid_token' };

/**
 * Extract the DB lookup key (jti) from a wire token.
 *
 * For signed tokens, this is the jti from the verified payload.
 * For legacy opaque tokens, the token itself is the DB key.
 *
 * Returns null if the token is signed but the signature is invalid.
 */
function extractDbKey(token: string): { key: string; legacy: boolean } | null {
  if (!isSignedToken(token)) {
    // Legacy opaque UUID token — use as-is.
    log.warn('[DEPRECATED] Legacy unsigned share token presented; use signed tokens', {
      tokenPrefix: token.slice(0, 8),
    });
    return { key: token, legacy: true };
  }

  const result = verifyToken(token);

  if (!result.ok) {
    if (result.reason === 'no_key') {
      // No public key configured — try to extract jti from the payload without verification.
      // This covers development/test environments without key material.
      const dotIdx = token.lastIndexOf('.');
      const payloadB64 = token.slice(0, dotIdx);
      try {
        const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        const pad = (4 - (padded.length % 4)) % 4;
        const buf = Buffer.from(padded + '='.repeat(pad), 'base64');
        const payload = JSON.parse(buf.toString('utf8')) as { jti?: string };
        if (payload.jti) return { key: payload.jti, legacy: false };
      } catch {
        /* fall through to null */
      }
      return null;
    }
    // Tampered or malformed — reject immediately.
    log.warn('Share token signature verification failed', { reason: result.reason });
    return null;
  }

  return { key: result.payload.jti, legacy: false };
}

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

      // The jti is the stable opaque DB lookup key.
      const jti = generateToken();

      const link: ShareLink = {
        token: jti,
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

      // Attempt to produce a signed wire token. Fall back to the raw jti if
      // the private key is unavailable (development / test environments).
      const expSecs = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : 0;
      const signed = signToken({
        jti,
        docId: input.docId,
        role: input.role,
        exp: expSecs,
        rid: input.recipientId ?? '',
      });

      const wireToken = signed ?? jti;
      return { link, wireToken };
    },

    async resolve(token, password, options) {
      const extracted = extractDbKey(token);
      if (!extracted) {
        return { ok: false, reason: 'invalid_token' };
      }

      const link = await store.findByToken(extracted.key);
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

      if (!options?.skipIncrement) {
        await store.update(extracted.key, { redemptionCount: link.redemptionCount + 1 });
      }
      return { ok: true, link };
    },

    async revoke(token) {
      const extracted = extractDbKey(token);
      if (!extracted) return false;
      const link = await store.findByToken(extracted.key);
      if (!link) return false;
      await store.update(extracted.key, { revoked: true });
      return true;
    },

    async getByToken(token) {
      const extracted = extractDbKey(token);
      if (!extracted) return null;
      return store.findByToken(extracted.key);
    },
  };
}
