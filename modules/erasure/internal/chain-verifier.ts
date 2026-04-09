/** Contract: contracts/erasure/rules.md */

import type { Pool } from 'pg';
import type { AuditEntry } from '../../audit/contract.ts';
import type { ChainVerifyResult, ErasureBridge } from '../contract.ts';
import { verifyHash } from '../../audit/internal/hmac-chain.ts';
import { verifyBridgeHash } from './bridge-hash.ts';
import * as auditStore from '../../audit/internal/audit-store.ts';
import * as erasureStore from './erasure-store.ts';

/**
 * Verify audit chain with erasure-bridge awareness.
 *
 * Walks the chain in chronological order. When a link is broken,
 * checks if a valid erasure bridge spans the gap. If so, the chain
 * is VALID_WITH_ERASURES. If not, it is TAMPERED.
 */
export async function verifyChainWithBridges(
  pool: Pool,
  documentId: string,
  hmacSecret: string,
): Promise<ChainVerifyResult> {
  const chain = await auditStore.getFullChain(pool, documentId);
  const bridges = await erasureStore.getBridgesForDocument(pool, documentId);

  if (chain.length === 0) {
    return {
      documentId,
      totalEntries: 0,
      status: 'VALID',
      erasureBridgeCount: bridges.length,
      brokenAtId: null,
    };
  }

  const bridgeIndex = buildBridgeIndex(bridges);
  let usedBridgeCount = 0;

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const expectedPrev = i === 0 ? null : chain[i - 1].hash;

    // Check hash integrity of the entry itself
    if (!verifyHash(entry, hmacSecret)) {
      return tampered(documentId, chain.length, usedBridgeCount, entry.id);
    }

    // Check chain link
    if (entry.previousHash !== expectedPrev) {
      // Chain is broken -- look for a valid erasure bridge
      const bridge = findBridge(bridgeIndex, expectedPrev, entry.previousHash);
      if (bridge && verifyBridgeHash(bridge, hmacSecret)) {
        usedBridgeCount++;
      } else {
        return tampered(documentId, chain.length, usedBridgeCount, entry.id);
      }
    }
  }

  const status = usedBridgeCount > 0 ? 'VALID_WITH_ERASURES' : 'VALID';
  return {
    documentId,
    totalEntries: chain.length,
    status,
    erasureBridgeCount: usedBridgeCount,
    brokenAtId: null,
  } satisfies ChainVerifyResult;
}

// --- Helpers ---

type BridgeKey = string; // preErasureHash

function buildBridgeIndex(bridges: ErasureBridge[]): Map<BridgeKey, ErasureBridge[]> {
  const index = new Map<BridgeKey, ErasureBridge[]>();
  for (const b of bridges) {
    const existing = index.get(b.preErasureHash) ?? [];
    existing.push(b);
    index.set(b.preErasureHash, existing);
  }
  return index;
}

/**
 * Find a bridge that spans from expectedPrev to the entry's actual previousHash.
 * The bridge's preErasureHash should match what we expected (the previous entry's hash),
 * and its postErasureHash should match what the entry actually references.
 */
function findBridge(
  index: Map<BridgeKey, ErasureBridge[]>,
  expectedPrev: string | null,
  actualPrev: string | null,
): ErasureBridge | null {
  if (expectedPrev === null || actualPrev === null) return null;
  const candidates = index.get(expectedPrev);
  if (!candidates) return null;
  return candidates.find((b) => b.postErasureHash === actualPrev) ?? null;
}

function tampered(
  documentId: string,
  totalEntries: number,
  erasureBridgeCount: number,
  brokenAtId: string,
): ChainVerifyResult {
  return {
    documentId,
    totalEntries,
    status: 'TAMPERED',
    erasureBridgeCount,
    brokenAtId,
  };
}
