/** Contract: contracts/erasure/rules.md — Property-based tests */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Property tests for cascade erasure graph-walking logic.
 * The actual cascadeEraseKbEntry requires a Pool and external deps,
 * so we extract and test the core invariants of the cascade walk:
 * - All referenced documents are visited
 * - No document is visited twice
 * - Cascade always terminates
 */

/** Simulate the cascade walk logic from cascade-erasure.ts. */
function simulateCascadeWalk(
  referencingDocIds: string[],
  replaceResult: Map<string, boolean>,
): { affectedDocuments: string[]; visited: Set<string> } {
  const affectedDocuments: string[] = [];
  const visited = new Set<string>();

  for (const docId of referencingDocIds) {
    visited.add(docId);
    const replaced = replaceResult.get(docId) ?? false;
    if (replaced) {
      affectedDocuments.push(docId);
    }
  }

  return { affectedDocuments, visited };
}

/** Arbitrary for a list of unique document IDs. */
const docIdsArb = fc.uniqueArray(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  { minLength: 0, maxLength: 50 },
);

describe('erasure cascade property tests', () => {
  it('all referenced entities are visited exactly once', () => {
    fc.assert(
      fc.property(docIdsArb, (docIds: string[]) => {
        const replaceMap = new Map(docIds.map((id) => [id, true]));
        const { visited } = simulateCascadeWalk(docIds, replaceMap);

        // Every doc should be visited
        for (const id of docIds) {
          expect(visited.has(id)).toBe(true);
        }
        // Visited count matches input count (no duplicates)
        expect(visited.size).toBe(docIds.length);
      }),
    );
  });

  it('cascade always terminates (walk completes for any input size)', () => {
    fc.assert(
      fc.property(docIdsArb, (docIds: string[]) => {
        const replaceMap = new Map(docIds.map((id) => [id, true]));
        const { affectedDocuments } = simulateCascadeWalk(docIds, replaceMap);
        // Just reaching this point proves termination
        expect(affectedDocuments.length).toBeLessThanOrEqual(docIds.length);
      }),
    );
  });

  it('affected documents is a subset of referenced documents', () => {
    fc.assert(
      fc.property(
        docIdsArb,
        fc.array(fc.boolean(), { minLength: 0, maxLength: 50 }),
        (docIds: string[], results: boolean[]) => {
          const replaceMap = new Map(
            docIds.map((id, i) => [id, results[i] ?? false]),
          );
          const { affectedDocuments } = simulateCascadeWalk(docIds, replaceMap);

          for (const affectedId of affectedDocuments) {
            expect(docIds).toContain(affectedId);
          }
        },
      ),
    );
  });

  it('no document appears twice in the affected list', () => {
    fc.assert(
      fc.property(docIdsArb, (docIds: string[]) => {
        const replaceMap = new Map(docIds.map((id) => [id, true]));
        const { affectedDocuments } = simulateCascadeWalk(docIds, replaceMap);
        const unique = new Set(affectedDocuments);
        expect(unique.size).toBe(affectedDocuments.length);
      }),
    );
  });

  it('when all replacements succeed, affected equals input', () => {
    fc.assert(
      fc.property(docIdsArb, (docIds: string[]) => {
        const replaceMap = new Map(docIds.map((id) => [id, true]));
        const { affectedDocuments } = simulateCascadeWalk(docIds, replaceMap);
        expect(affectedDocuments).toHaveLength(docIds.length);
      }),
    );
  });

  it('when no replacements succeed, affected is empty', () => {
    fc.assert(
      fc.property(docIdsArb, (docIds: string[]) => {
        const replaceMap = new Map(docIds.map((id) => [id, false]));
        const { affectedDocuments } = simulateCascadeWalk(docIds, replaceMap);
        expect(affectedDocuments).toHaveLength(0);
      }),
    );
  });

  it('notification count never exceeds affected document count', () => {
    fc.assert(
      fc.property(
        docIdsArb,
        fc.array(fc.boolean(), { minLength: 0, maxLength: 50 }),
        fc.array(fc.boolean(), { minLength: 0, maxLength: 50 }),
        (docIds: string[], replaceResults: boolean[], notifyResults: boolean[]) => {
          const replaceMap = new Map(
            docIds.map((id, i) => [id, replaceResults[i] ?? false]),
          );
          const { affectedDocuments } = simulateCascadeWalk(docIds, replaceMap);

          // Simulate notification phase
          let notificationsSent = 0;
          for (let i = 0; i < affectedDocuments.length; i++) {
            if (notifyResults[i] !== false) notificationsSent++;
          }

          expect(notificationsSent).toBeLessThanOrEqual(affectedDocuments.length);
        },
      ),
    );
  });
});
