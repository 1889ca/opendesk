/** Contract: contracts/kb/rules.md — Property-based tests */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseKbUri, buildKbUri } from './resolve-ref.ts';
import type { KbVersionRef } from '../contract.ts';

/** Arbitrary for valid UUID v4 strings. */
const uuidArb = fc.uuid().filter((u) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(u));

/** Arbitrary for a pinned version number. */
const versionArb = fc.integer({ min: 1, max: 10000 });

/** Arbitrary for a KbVersionRef. */
const kbRefArb = fc.oneof(
  fc.record({
    entryId: uuidArb,
    version: versionArb,
  }),
  fc.record({
    entryId: uuidArb,
    version: fc.constant('latest' as const),
  }),
);

describe('kb resolve-ref property tests', () => {
  it('buildKbUri then parseKbUri is identity (roundtrip)', () => {
    fc.assert(
      fc.property(kbRefArb, (ref: KbVersionRef) => {
        const uri = buildKbUri(ref);
        const parsed = parseKbUri(uri);
        expect(parsed).not.toBeNull();
        expect(parsed!.entryId).toBe(ref.entryId);
        expect(parsed!.version).toBe(ref.version);
      }),
    );
  });

  it('buildKbUri always produces a kb:// URI', () => {
    fc.assert(
      fc.property(kbRefArb, (ref: KbVersionRef) => {
        const uri = buildKbUri(ref);
        expect(uri).toMatch(/^kb:\/\//);
      }),
    );
  });

  it('buildKbUri contains the entry ID', () => {
    fc.assert(
      fc.property(kbRefArb, (ref: KbVersionRef) => {
        const uri = buildKbUri(ref);
        expect(uri).toContain(ref.entryId);
      }),
    );
  });

  it('parseKbUri returns null for non-kb URIs', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.startsWith('kb://')),
        (input: string) => {
          const result = parseKbUri(input);
          expect(result).toBeNull();
        },
      ),
    );
  });

  it('parseKbUri rejects URIs with invalid UUID', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !/^[0-9a-f-]{36}$/.test(s)),
        (badId: string) => {
          const result = parseKbUri(`kb://${badId}@latest`);
          expect(result).toBeNull();
        },
      ),
    );
  });

  it('pinned version URIs contain v prefix and number', () => {
    fc.assert(
      fc.property(
        uuidArb,
        versionArb,
        (entryId: string, version: number) => {
          const ref: KbVersionRef = { entryId, version };
          const uri = buildKbUri(ref);
          expect(uri).toContain(`@v${version}`);
        },
      ),
    );
  });

  it('latest version URIs end with @latest', () => {
    fc.assert(
      fc.property(
        uuidArb,
        (entryId: string) => {
          const ref: KbVersionRef = { entryId, version: 'latest' };
          const uri = buildKbUri(ref);
          expect(uri).toMatch(/@latest$/);
        },
      ),
    );
  });
});
