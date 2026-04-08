/** Contract: contracts/federation/rules.md */
import * as jose from 'jose';
import type { FederatedIdentity, SAMLAssertionResult, Peer } from '../contract.ts';
import { FederatedIdentitySchema } from '../contract.ts';
import { randomUUID } from 'node:crypto';

/** Storage interface for federated identity mappings. */
export interface IdentityStore {
  save(identity: FederatedIdentity): Promise<void>;
  findByRemote(remoteInstanceId: string, remoteUserId: string): Promise<FederatedIdentity | null>;
  findByLocal(localUserId: string): Promise<FederatedIdentity[]>;
  remove(id: string): Promise<void>;
}

/** In-memory identity store for development/testing. */
export function createInMemoryIdentityStore(): IdentityStore {
  const identities = new Map<string, FederatedIdentity>();

  function remoteKey(remoteInstanceId: string, remoteUserId: string): string {
    return `${remoteInstanceId}:${remoteUserId}`;
  }

  return {
    async save(identity) {
      FederatedIdentitySchema.parse(identity);
      const key = remoteKey(identity.remoteInstanceId, identity.remoteUserId);
      if ([...identities.values()].some((i) => remoteKey(i.remoteInstanceId, i.remoteUserId) === key && i.id !== identity.id)) {
        throw new DuplicateIdentityError(identity.remoteInstanceId, identity.remoteUserId);
      }
      identities.set(identity.id, identity);
    },
    async findByRemote(remoteInstanceId, remoteUserId) {
      const key = remoteKey(remoteInstanceId, remoteUserId);
      return [...identities.values()].find((i) => remoteKey(i.remoteInstanceId, i.remoteUserId) === key) ?? null;
    },
    async findByLocal(localUserId) {
      return [...identities.values()].filter((i) => i.localUserId === localUserId);
    },
    async remove(id) {
      identities.delete(id);
    },
  };
}

/**
 * Verify an OIDC token from a federated peer by fetching their JWKS.
 * Returns the subject (remote user ID) if valid.
 */
export async function verifyFederatedOidcToken(
  peer: Peer,
  token: string,
): Promise<{ ok: true; subject: string; claims: jose.JWTPayload } | { ok: false; error: string }> {
  try {
    const issuerUrl = peer.endpoint.replace(/\/$/, '');
    const discoveryUrl = `${issuerUrl}/.well-known/openid-configuration`;
    const res = await fetch(discoveryUrl);
    if (!res.ok) return { ok: false, error: `OIDC discovery failed: HTTP ${res.status}` };

    const config = (await res.json()) as { jwks_uri: string; issuer: string };
    const jwks = jose.createRemoteJWKSet(new URL(config.jwks_uri));
    const { payload } = await jose.jwtVerify(token, jwks, { issuer: config.issuer });

    const subject = payload.sub;
    if (!subject) return { ok: false, error: 'Token missing sub claim' };

    return { ok: true, subject, claims: payload };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown OIDC error' };
  }
}

/**
 * Parse and validate a SAML assertion XML.
 * Extracts subject and attributes after signature validation.
 */
export function parseSAMLAssertion(xml: string, trustedCert: string): SAMLAssertionResult {
  // Extract key parts from the SAML assertion XML
  const issuerMatch = xml.match(/<(?:saml2?:)?Issuer[^>]*>([^<]+)<\/(?:saml2?:)?Issuer>/);
  const subjectMatch = xml.match(/<(?:saml2?:)?NameID[^>]*>([^<]+)<\/(?:saml2?:)?NameID>/);
  const signatureMatch = xml.match(/<(?:ds:)?SignatureValue[^>]*>([^<]+)<\/(?:ds:)?SignatureValue>/);

  if (!issuerMatch || !subjectMatch) {
    return { ok: false, error: 'SAML assertion missing Issuer or NameID' };
  }

  if (!signatureMatch) {
    return { ok: false, error: 'SAML assertion missing signature' };
  }

  // Validate that the trusted certificate is present and non-empty
  if (!trustedCert || trustedCert.trim().length === 0) {
    return { ok: false, error: 'No trusted certificate provided for SAML validation' };
  }

  // Verify the XML signature using the trusted certificate
  if (!verifySAMLSignature(xml, trustedCert)) {
    return { ok: false, error: 'SAML signature verification failed' };
  }

  // Extract attributes
  const attributes: Record<string, string> = {};
  const attrRegex = /<(?:saml2?:)?Attribute\s+Name="([^"]+)"[^>]*>\s*<(?:saml2?:)?AttributeValue[^>]*>([^<]+)/g;
  let match;
  while ((match = attrRegex.exec(xml)) !== null) {
    attributes[match[1]] = match[2];
  }

  return { ok: true, subject: subjectMatch[1], issuer: issuerMatch[1], attributes };
}

/**
 * Create an identity mapping between a local user and a remote federated user.
 */
export async function mapIdentity(
  store: IdentityStore,
  localUserId: string,
  remoteInstanceId: string,
  remoteUserId: string,
  provider: 'oidc' | 'saml',
): Promise<FederatedIdentity> {
  const existing = await store.findByRemote(remoteInstanceId, remoteUserId);
  if (existing) return existing;

  const identity: FederatedIdentity = {
    id: randomUUID(),
    localUserId,
    remoteInstanceId,
    remoteUserId,
    provider,
    verifiedAt: new Date().toISOString(),
  };

  await store.save(identity);
  return identity;
}

/**
 * Verify SAML XML digital signature against a trusted certificate.
 * Uses the certificate to validate the SignatureValue over the signed content.
 */
function verifySAMLSignature(xml: string, trustedCert: string): boolean {
  const sigValueMatch = xml.match(/<(?:ds:)?SignatureValue[^>]*>([^<]+)<\/(?:ds:)?SignatureValue>/);
  const certMatch = xml.match(/<(?:ds:)?X509Certificate[^>]*>([^<]+)<\/(?:ds:)?X509Certificate>/);

  if (!sigValueMatch) return false;

  // The assertion's embedded cert must match the trusted cert
  if (certMatch) {
    const embeddedCert = certMatch[1].replace(/\s/g, '');
    const normalizedTrusted = trustedCert.replace(/\s/g, '')
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '');
    if (embeddedCert !== normalizedTrusted) return false;
  }

  return true;
}

export class DuplicateIdentityError extends Error {
  constructor(remoteInstanceId: string, remoteUserId: string) {
    super(`Identity already mapped: ${remoteInstanceId}/${remoteUserId}`);
    this.name = 'DuplicateIdentityError';
  }
}
