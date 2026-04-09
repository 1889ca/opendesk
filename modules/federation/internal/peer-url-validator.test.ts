/** Contract: contracts/federation/rules.md */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  isLoopback,
  isLinkLocal,
  isPrivate,
} from './peer-url-validator.ts';

const octet = fc.integer({ min: 0, max: 255 });

// Property-based tests for the pure IP-range helpers used by the
// peer-url validator (issue #131). Async behavior of validatePeerUrl
// itself is covered in validate-peer-url.test.ts.

describe('isLoopback', () => {
  it('accepts every address in 127.0.0.0/8', () => {
    fc.assert(
      fc.property(octet, octet, octet, (b: number, c: number, d: number) => {
        expect(isLoopback(`127.${b}.${c}.${d}`)).toBe(true);
      }),
    );
  });

  it('rejects representative non-127 addresses', () => {
    const samples = [1, 8, 100, 128, 169, 172, 192, 200, 240];
    for (const a of samples) {
      fc.assert(
        fc.property(octet, octet, octet, (b: number, c: number, d: number) => {
          expect(isLoopback(`${a}.${b}.${c}.${d}`)).toBe(false);
        }),
      );
    }
  });

  it('matches IPv6 loopback ::1', () => {
    expect(isLoopback('::1')).toBe(true);
  });
});

describe('isLinkLocal', () => {
  it('accepts every address in 169.254.0.0/16', () => {
    fc.assert(
      fc.property(octet, octet, (c: number, d: number) => {
        expect(isLinkLocal(`169.254.${c}.${d}`)).toBe(true);
      }),
    );
  });

  it('catches the cloud-metadata IP 169.254.169.254 specifically', () => {
    expect(isLinkLocal('169.254.169.254')).toBe(true);
  });

  it('matches IPv6 link-local fe80::', () => {
    expect(isLinkLocal('fe80::1')).toBe(true);
    expect(isLinkLocal('feba::1')).toBe(true);
  });

  it('does not flag 169.253.x.x or 170.x.x.x', () => {
    expect(isLinkLocal('169.253.0.1')).toBe(false);
    expect(isLinkLocal('170.0.0.1')).toBe(false);
  });
});

describe('isPrivate', () => {
  it('accepts every address in 10.0.0.0/8', () => {
    fc.assert(
      fc.property(octet, octet, octet, (b: number, c: number, d: number) => {
        expect(isPrivate(`10.${b}.${c}.${d}`)).toBe(true);
      }),
    );
  });

  it('accepts 172.16.0.0/12 boundaries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 16, max: 31 }),
        octet,
        octet,
        (b: number, c: number, d: number) => {
          expect(isPrivate(`172.${b}.${c}.${d}`)).toBe(true);
        },
      ),
    );
  });

  it('rejects 172.15 and 172.32 (just outside the range)', () => {
    expect(isPrivate('172.15.255.255')).toBe(false);
    expect(isPrivate('172.32.0.0')).toBe(false);
  });

  it('accepts every address in 192.168.0.0/16', () => {
    fc.assert(
      fc.property(octet, octet, (c: number, d: number) => {
        expect(isPrivate(`192.168.${c}.${d}`)).toBe(true);
      }),
    );
  });

  it('accepts IPv6 ULA fc00::/7', () => {
    expect(isPrivate('fc00::1')).toBe(true);
    expect(isPrivate('fd12::1')).toBe(true);
  });

  it('rejects public IPs', () => {
    expect(isPrivate('8.8.8.8')).toBe(false);
    expect(isPrivate('1.1.1.1')).toBe(false);
    expect(isPrivate('142.250.80.46')).toBe(false);
  });
});
