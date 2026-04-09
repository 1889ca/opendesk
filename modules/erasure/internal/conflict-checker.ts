/** Contract: contracts/erasure/rules.md */

import type { Pool } from 'pg';
import type { ErasureConflict, LegalHold } from '../contract.ts';
import * as store from './erasure-store.ts';

/**
 * Check for conflicts that would prevent or warn about document erasure.
 *
 * Conflict types:
 * - LEGAL_HOLD: litigation hold blocks erasure entirely
 * - ACTIVE_EDISCOVERY: eDiscovery hold warns (requires override)
 * - REGULATORY_FILING: regulatory hold requires explicit authorization
 */
export async function checkConflicts(
  pool: Pool,
  documentId: string,
): Promise<ErasureConflict[]> {
  const holds = await store.getActiveHolds(pool, documentId);
  return holds.map(holdToConflict);
}

function holdToConflict(hold: LegalHold): ErasureConflict {
  switch (hold.holdType) {
    case 'litigation':
      return {
        type: 'LEGAL_HOLD',
        holdId: hold.id,
        authority: hold.authority,
        blocking: true,
        message: `Document is under litigation hold by ${hold.authority}. Erasure is blocked.`,
      };
    case 'ediscovery':
      return {
        type: 'ACTIVE_EDISCOVERY',
        holdId: hold.id,
        authority: hold.authority,
        blocking: false,
        message: `Document is part of active eDiscovery by ${hold.authority}. Override required.`,
      };
    case 'regulatory':
      return {
        type: 'REGULATORY_FILING',
        holdId: hold.id,
        authority: hold.authority,
        blocking: true,
        message: `Document is referenced by regulatory filing from ${hold.authority}. Explicit authorization required.`,
      };
  }
}
