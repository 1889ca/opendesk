/** Contract: contracts/federation/rules.md */
import { describe, it, expect } from 'vitest';
import {
  validatePeerUrl,
  PeerUrlValidationError,
} from './peer-url-validator.ts';

// Async/integration tests for validatePeerUrl. The pure IP-range
// helpers are property-tested in peer-url-validator.test.ts.

describe('validatePeerUrl', () => {
  describe('scheme', () => {
    it('rejects http:// by default', async () => {
      await expect(validatePeerUrl('http://8.8.8.8/')).rejects.toMatchObject({
        code: 'INVALID_SCHEME',
      });
    });

    it('rejects ws:// by default', async () => {
      await expect(validatePeerUrl('ws://8.8.8.8/')).rejects.toMatchObject({
        code: 'INVALID_SCHEME',
      });
    });

    it('accepts https:// to a public IP', async () => {
      await expect(validatePeerUrl('https://8.8.8.8/')).resolves.toBeInstanceOf(URL);
    });

    it('accepts wss:// to a public IP', async () => {
      await expect(validatePeerUrl('wss://1.1.1.1/sync')).resolves.toBeInstanceOf(URL);
    });

    it('allows http:// when allowInsecureSchemes=true (test/dev only)', async () => {
      await expect(
        validatePeerUrl('http://8.8.8.8/', { allowInsecureSchemes: true }),
      ).resolves.toBeInstanceOf(URL);
    });

    it('rejects ftp:// even with allowInsecureSchemes=true', async () => {
      await expect(
        validatePeerUrl('ftp://8.8.8.8/', { allowInsecureSchemes: true }),
      ).rejects.toMatchObject({ code: 'INVALID_SCHEME' });
    });
  });

  describe('IP-literal hostnames bypass DNS', () => {
    const rejectionCases: Array<[string, string, string]> = [
      ['loopback IP literal', 'https://127.0.0.1/', 'LOOPBACK_FORBIDDEN'],
      ['top of 127/8', 'https://127.255.255.255/', 'LOOPBACK_FORBIDDEN'],
      ['IPv6 loopback', 'https://[::1]/', 'LOOPBACK_FORBIDDEN'],
      ['cloud-metadata 169.254.169.254', 'https://169.254.169.254/', 'LINK_LOCAL_FORBIDDEN'],
      ['10/8 RFC1918', 'https://10.0.0.1/', 'PRIVATE_FORBIDDEN'],
      ['192.168/16 RFC1918', 'https://192.168.1.100/', 'PRIVATE_FORBIDDEN'],
      ['172.16-31 RFC1918', 'https://172.20.0.5/', 'PRIVATE_FORBIDDEN'],
    ];

    for (const [label, url, code] of rejectionCases) {
      it(`rejects ${label}`, async () => {
        await expect(validatePeerUrl(url)).rejects.toMatchObject({ code });
      });
    }

    it('allows RFC1918 when allowPrivateNetworks=true', async () => {
      await expect(
        validatePeerUrl('https://10.0.0.1/', { allowPrivateNetworks: true }),
      ).resolves.toBeInstanceOf(URL);
    });

    it('does NOT allow loopback even with allowPrivateNetworks=true', async () => {
      await expect(
        validatePeerUrl('https://127.0.0.1/', { allowPrivateNetworks: true }),
      ).rejects.toMatchObject({ code: 'LOOPBACK_FORBIDDEN' });
    });

    it('does NOT allow link-local even with allowPrivateNetworks=true', async () => {
      await expect(
        validatePeerUrl('https://169.254.169.254/', { allowPrivateNetworks: true }),
      ).rejects.toMatchObject({ code: 'LINK_LOCAL_FORBIDDEN' });
    });
  });

  describe('hostname rejection paths', () => {
    it('rejects 0.0.0.0 wildcard via the WILDCARD_FORBIDDEN guard', async () => {
      await expect(validatePeerUrl('https://0.0.0.0/')).rejects.toMatchObject({
        code: 'WILDCARD_FORBIDDEN',
      });
    });

    it('rejects malformed URLs', async () => {
      await expect(validatePeerUrl('not a url')).rejects.toMatchObject({
        code: 'INVALID_URL',
      });
    });

    it('rejects unresolvable hostnames', async () => {
      await expect(
        validatePeerUrl('https://this-host-definitely-does-not-exist-opendesk-test.invalid/'),
      ).rejects.toMatchObject({ code: 'DNS_FAILED' });
    });
  });

  describe('localhost via DNS resolution', () => {
    it('rejects https://localhost/ because it resolves to loopback', async () => {
      await expect(validatePeerUrl('https://localhost/')).rejects.toMatchObject({
        code: 'LOOPBACK_FORBIDDEN',
      });
    });
  });

  it('returns the parsed URL on success', async () => {
    const result = await validatePeerUrl('https://8.8.8.8:443/federation/sync/abc');
    expect(result).toBeInstanceOf(URL);
    expect(result.protocol).toBe('https:');
    expect(result.hostname).toBe('8.8.8.8');
    expect(result.pathname).toBe('/federation/sync/abc');
  });

  it('error type is PeerUrlValidationError', async () => {
    try {
      await validatePeerUrl('https://127.0.0.1/');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PeerUrlValidationError);
    }
  });
});
