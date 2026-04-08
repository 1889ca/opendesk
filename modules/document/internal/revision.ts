/** Contract: contracts/document/rules.md */
import { createHash } from 'node:crypto';
import type { RevisionId } from '../contract/index.ts';

export function computeRevisionId(stateVector: Uint8Array): RevisionId {
  return createHash('sha256').update(stateVector).digest('hex');
}
