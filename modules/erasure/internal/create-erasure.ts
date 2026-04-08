/** Contract: contracts/erasure/rules.md */

import type { Pool } from 'pg';
import type {
  ErasureModule,
  TombstoneReport,
  AnonymizationResult,
  RedactionResult,
  CascadeResult,
  PrunePreview,
  PruneResult,
  RetentionPolicy,
  ErasureAttestation,
  ErasureType,
} from '../contract.ts';
import { extractTombstones } from './tombstone-scanner.ts';
import { anonymizeDocument } from './anonymizer.ts';
import { redactContent } from './redaction.ts';
import { cascadeEraseKbEntry, type CascadeDependencies } from './cascade-erasure.ts';
import * as retention from './retention-engine.ts';
import { createAttestation } from './attestation.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('erasure');

export type ErasureDependencies = {
  pool: Pool;
  hmacSecret: string;
  /** Load CRDT state for a document. */
  loadDocumentState: (docId: string) => Promise<Uint8Array>;
  /** Persist updated CRDT state for a document. */
  saveDocumentState: (docId: string, state: Uint8Array) => Promise<void>;
  /** Cascade erasure dependencies for KB references. */
  cascade: Omit<CascadeDependencies, 'pool' | 'hmacSecret'>;
};

/**
 * Factory: creates the erasure module.
 */
export function createErasure(deps: ErasureDependencies): ErasureModule {
  const { pool, hmacSecret, loadDocumentState, saveDocumentState, cascade } = deps;

  return {
    async extractTombstones(docId: string): Promise<TombstoneReport> {
      const state = await loadDocumentState(docId);
      return extractTombstones(docId, state);
    },

    async anonymizeDocument(
      docId: string,
      targetUserId: string,
      legalBasis: string,
      requestedBy: string,
    ): Promise<AnonymizationResult> {
      const state = await loadDocumentState(docId);
      const result = anonymizeDocument(docId, targetUserId, state);

      await saveDocumentState(docId, result.newState);
      await createAttestation(
        pool, hmacSecret, docId, 'anonymization', requestedBy, legalBasis,
        `Anonymized ${result.itemsAnonymized} items for user ${targetUserId}`,
      );

      log.info('document anonymized', { docId, targetUserId, items: result.itemsAnonymized });
      return result;
    },

    async redactContent(
      docId: string,
      opts: { userId?: string; pattern?: string; legalBasis: string; requestedBy: string },
    ): Promise<RedactionResult> {
      const state = await loadDocumentState(docId);
      const result = await redactContent(pool, hmacSecret, docId, state, opts);

      await saveDocumentState(docId, result.newState);
      log.info('content redacted', { docId, count: result.redactedCount });

      return {
        docId,
        redactedCount: result.redactedCount,
        attestation: result.attestation,
      };
    },

    async cascadeEraseKbEntry(
      entryId: string,
      legalBasis: string,
      requestedBy: string,
    ): Promise<CascadeResult> {
      return cascadeEraseKbEntry(
        { pool, hmacSecret, ...cascade },
        entryId,
        legalBasis,
        requestedBy,
      );
    },

    async previewPrune(policyId: string): Promise<PrunePreview> {
      return retention.previewPrune(pool, policyId);
    },

    async executePrune(policyId: string, requestedBy: string): Promise<PruneResult> {
      return retention.executePrune(pool, hmacSecret, policyId, requestedBy);
    },

    async upsertPolicy(policy: RetentionPolicy): Promise<RetentionPolicy> {
      return retention.upsertPolicy(pool, policy);
    },

    async listPolicies(): Promise<RetentionPolicy[]> {
      return retention.listPolicies(pool);
    },

    async createAttestation(
      docId: string,
      type: ErasureType,
      actorId: string,
      legalBasis: string,
      details: string,
    ): Promise<ErasureAttestation> {
      return createAttestation(pool, hmacSecret, docId, type, actorId, legalBasis, details);
    },
  };
}
