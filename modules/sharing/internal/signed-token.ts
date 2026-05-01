/** Contract: contracts/sharing/rules.md */

/**
 * Ed25519-signed share token implementation.
 *
 * Wire format: base64url(JSON payload) + "." + base64url(signature)
 *
 * The payload contains:
 *   - jti: cryptographically random 32-byte hex string (the DB lookup key)
 *   - docId: document ID
 *   - role: GrantRole
 *   - exp: Unix epoch seconds (expiry, may be 0 = no expiry)
 *   - rid: recipientId (optional — populated for invite links, empty for open links)
 *
 * Security properties:
 *   - Signature is verified before any DB lookup, so tampered tokens are rejected
 *     in O(1) without hitting the database.
 *   - The jti is the stable opaque DB key; the rest of the payload is informational
 *     but trusted only after signature verification.
 *   - Backward compatibility: tokens that contain no "." are treated as legacy
 *     opaque UUID tokens and resolved via DB lookup with a deprecation warning.
 *
 * Key management:
 *   - SHARE_TOKEN_PRIVATE_KEY env var: PEM-encoded Ed25519 private key (PKCS#8)
 *   - SHARE_TOKEN_PUBLIC_KEY  env var: PEM-encoded Ed25519 public key  (SPKI)
 *
 * To generate a key pair:
 *   node -e "
 *     const { generateKeyPairSync } = require('node:crypto');
 *     const { privateKey, publicKey } = generateKeyPairSync('ed25519');
 *     console.log(privateKey.export({ type: 'pkcs8', format: 'pem' }));
 *     console.log(publicKey.export({ type: 'spki', format: 'pem' }));
 *   "
 */

import { sign, verify, createPrivateKey, createPublicKey } from 'node:crypto';
import type { GrantRole } from '../contract.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('sharing:signed-token');

export interface SignedTokenPayload {
  /** JWT-ID: the opaque DB lookup key (32-byte hex, 256-bit entropy). */
  jti: string;
  /** Document ID. */
  docId: string;
  /** Grant role. */
  role: GrantRole;
  /**
   * Expiry as Unix epoch seconds. 0 means no expiry. The DB-level
   * expiresAt remains authoritative; this is an early-rejection hint.
   */
  exp: number;
  /**
   * Recipient user ID for invite-targeted tokens. Empty string for
   * open share links that anyone can redeem.
   */
  rid: string;
}

function b64uEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64uDecode(s: string): Buffer {
  // Restore standard base64 padding
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(pad), 'base64');
}

function loadPrivateKey(): import('node:crypto').KeyObject | null {
  const pem = process.env.SHARE_TOKEN_PRIVATE_KEY;
  if (!pem) return null;
  try {
    return createPrivateKey(pem.replace(/\\n/g, '\n'));
  } catch (err) {
    log.error('Failed to load SHARE_TOKEN_PRIVATE_KEY', { err });
    return null;
  }
}

function loadPublicKey(): import('node:crypto').KeyObject | null {
  const pem = process.env.SHARE_TOKEN_PUBLIC_KEY;
  if (!pem) return null;
  try {
    return createPublicKey(pem.replace(/\\n/g, '\n'));
  } catch (err) {
    log.error('Failed to load SHARE_TOKEN_PUBLIC_KEY', { err });
    return null;
  }
}

/**
 * Sign a token payload with the Ed25519 private key.
 *
 * Returns null if the private key is unavailable (legacy mode fallback).
 */
export function signToken(payload: SignedTokenPayload): string | null {
  const privateKey = loadPrivateKey();
  if (!privateKey) return null;

  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const payloadB64 = b64uEncode(payloadBuf);

  let sigBuf: Buffer;
  try {
    sigBuf = sign(null, payloadBuf, privateKey) as Buffer;
  } catch (err) {
    log.error('Ed25519 signing failed', { err });
    return null;
  }

  return payloadB64 + '.' + b64uEncode(sigBuf);
}

export type VerifyTokenResult =
  | { ok: true; payload: SignedTokenPayload }
  | { ok: false; reason: 'invalid_format' | 'invalid_signature' | 'no_key' | 'tampered' };

/**
 * Verify a signed token string and extract its payload.
 *
 * Returns { ok: false, reason: 'no_key' } when no public key is configured,
 * which triggers the legacy DB-lookup path.
 */
export function verifyToken(token: string): VerifyTokenResult {
  if (!token.includes('.')) {
    // Legacy opaque UUID token — no dot separator means pre-signed era.
    return { ok: false, reason: 'no_key' };
  }

  const publicKey = loadPublicKey();
  if (!publicKey) {
    return { ok: false, reason: 'no_key' };
  }

  const dotIdx = token.lastIndexOf('.');
  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);

  let payloadBuf: Buffer;
  let sigBuf: Buffer;
  try {
    payloadBuf = b64uDecode(payloadB64);
    sigBuf = b64uDecode(sigB64);
  } catch {
    return { ok: false, reason: 'invalid_format' };
  }

  let valid: boolean;
  try {
    valid = verify(null, payloadBuf, publicKey, sigBuf);
  } catch {
    return { ok: false, reason: 'invalid_signature' };
  }

  if (!valid) {
    return { ok: false, reason: 'invalid_signature' };
  }

  let payload: SignedTokenPayload;
  try {
    payload = JSON.parse(payloadBuf.toString('utf8')) as SignedTokenPayload;
    if (!payload.jti || !payload.docId || !payload.role) {
      return { ok: false, reason: 'tampered' };
    }
  } catch {
    return { ok: false, reason: 'tampered' };
  }

  // Early expiry check (authoritative check still happens in the DB layer).
  if (payload.exp > 0 && payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'tampered' };
  }

  return { ok: true, payload };
}

/**
 * Returns true if the given string looks like a signed token (contains ".").
 */
export function isSignedToken(token: string): boolean {
  return token.includes('.');
}
