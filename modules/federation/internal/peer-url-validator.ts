/** Contract: contracts/federation/rules.md */

import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

/**
 * Peer URL safety validator (issue #131).
 *
 * Federation lets an admin register a peer's HTTP/WS endpoint. Without
 * URL validation, an attacker (or compromised admin) can point a peer
 * at internal infrastructure and pivot through the API process:
 *
 * - `http://127.0.0.1:6379` → talk to local Redis
 * - `http://169.254.169.254/...` → exfiltrate cloud metadata creds
 * - `http://10.0.0.1` → reach internal LAN services
 * - `http://minio:9000` → reach the S3 backend
 *
 * This validator gates `registerPeer` and `openSyncChannel` so a
 * peer URL is rejected unless its hostname resolves to a public
 * routable address.
 *
 * The IP-range checks are exposed as pure helpers so they can be
 * exercised by property-based tests without DNS.
 */

export class PeerUrlValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_URL'
      | 'INVALID_SCHEME'
      | 'DNS_FAILED'
      | 'LOOPBACK_FORBIDDEN'
      | 'LINK_LOCAL_FORBIDDEN'
      | 'PRIVATE_FORBIDDEN'
      | 'WILDCARD_FORBIDDEN',
  ) {
    super(message);
    this.name = 'PeerUrlValidationError';
  }
}

export interface ValidatePeerUrlOptions {
  /**
   * Allow RFC1918 / IPv6 ULA addresses. Self-hosters running federated
   * instances on a LAN must opt in via OPENDESK_FEDERATION_ALLOW_PRIVATE.
   * Loopback and link-local are *always* forbidden regardless.
   */
  allowPrivateNetworks?: boolean;
  /**
   * Permit ws:// and http:// schemes (in addition to wss:// and https://).
   * Off by default — federation traffic must be encrypted in production.
   */
  allowInsecureSchemes?: boolean;
}

/** IPv4 loopback (127.0.0.0/8) or IPv6 loopback (::1). */
export function isLoopback(ip: string): boolean {
  if (ip === '::1') return true;
  if (ip === '0.0.0.0' || ip === '::') return true;
  return /^127\./.test(ip);
}

/**
 * IPv4 link-local (169.254.0.0/16, includes 169.254.169.254 cloud
 * metadata) or IPv6 link-local (fe80::/10).
 */
export function isLinkLocal(ip: string): boolean {
  if (/^169\.254\./.test(ip)) return true;
  // IPv6 link-local: fe80::/10 → first 10 bits are 1111111010
  // First byte is 0xfe (1111_1110), second byte's high two bits are 10 (0x80-0xbf)
  return /^fe[89ab][0-9a-f]?:/i.test(ip);
}

/** RFC1918 private IPv4 or IPv6 ULA (fc00::/7). */
export function isPrivate(ip: string): boolean {
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  // 172.16.0.0/12 = 172.16.0.0 through 172.31.255.255
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  // IPv6 ULA: fc00::/7 → first byte is 0xfc or 0xfd
  return /^f[cd][0-9a-f]{2}:/i.test(ip);
}

/** Strip surrounding brackets from a URL.hostname IPv6 form like "[::1]". */
function stripIpv6Brackets(host: string): string {
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1);
  }
  return host;
}

/**
 * Validate that a peer endpoint URL is safe to use for outbound
 * federation traffic. Returns the parsed URL on success; throws
 * PeerUrlValidationError on any rejection.
 *
 * Performs DNS resolution for non-IP hostnames so a hostname
 * pointing at an internal IP cannot bypass the check.
 */
export async function validatePeerUrl(
  rawUrl: string,
  opts: ValidatePeerUrlOptions = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PeerUrlValidationError(`Invalid peer URL: ${rawUrl}`, 'INVALID_URL');
  }

  const allowedSchemes = opts.allowInsecureSchemes
    ? new Set(['http:', 'https:', 'ws:', 'wss:'])
    : new Set(['https:', 'wss:']);
  if (!allowedSchemes.has(url.protocol)) {
    throw new PeerUrlValidationError(
      `Peer URL scheme '${url.protocol}' not allowed (must be https:// or wss://)`,
      'INVALID_SCHEME',
    );
  }

  const hostname = stripIpv6Brackets(url.hostname);

  if (!hostname) {
    throw new PeerUrlValidationError('Peer URL has no hostname', 'INVALID_URL');
  }

  // Wildcard addresses are never legitimate destinations.
  if (hostname === '0.0.0.0' || hostname === '::' || hostname === '*') {
    throw new PeerUrlValidationError(
      `Peer URL hostname '${hostname}' is a wildcard, not a destination`,
      'WILDCARD_FORBIDDEN',
    );
  }

  let addresses: string[];

  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const records = await dns.lookup(hostname, { all: true, verbatim: true });
      addresses = records.map((r) => r.address);
    } catch {
      throw new PeerUrlValidationError(
        `Cannot resolve peer hostname '${hostname}'`,
        'DNS_FAILED',
      );
    }
  }

  if (addresses.length === 0) {
    throw new PeerUrlValidationError(
      `Peer hostname '${hostname}' resolved to no addresses`,
      'DNS_FAILED',
    );
  }

  for (const ip of addresses) {
    if (isLoopback(ip)) {
      throw new PeerUrlValidationError(
        `Peer URL resolves to loopback address (${ip})`,
        'LOOPBACK_FORBIDDEN',
      );
    }
    if (isLinkLocal(ip)) {
      throw new PeerUrlValidationError(
        `Peer URL resolves to link-local address (${ip}) — blocks cloud-metadata SSRF`,
        'LINK_LOCAL_FORBIDDEN',
      );
    }
    if (!opts.allowPrivateNetworks && isPrivate(ip)) {
      throw new PeerUrlValidationError(
        `Peer URL resolves to private network address (${ip}). Set OPENDESK_FEDERATION_ALLOW_PRIVATE=true if intentional.`,
        'PRIVATE_FORBIDDEN',
      );
    }
  }

  return url;
}
