/** Contract: contracts/erasure/rules.md */

import type { Pool } from 'pg';
import type { CascadeResult } from '../contract.ts';
import { createAttestation } from './attestation.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('erasure:cascade');

export type CascadeDependencies = {
  pool: Pool;
  hmacSecret: string;
  /** Find all document IDs that reference a KB entry. */
  findReferencingDocuments: (entryId: string) => Promise<string[]>;
  /** Replace KB reference content in a document with a placeholder. */
  replaceKbReference: (docId: string, entryId: string, placeholder: string) => Promise<boolean>;
  /** Send a notification to a document owner about cascade erasure. */
  notifyDocumentOwner: (docId: string, entryId: string, reason: string) => Promise<void>;
};

const KB_REMOVED_PLACEHOLDER = '[Removed]';

/**
 * Cascade-erase a KB entry: find all referencing documents,
 * replace references with a placeholder, notify owners,
 * and generate an attestation.
 */
export async function cascadeEraseKbEntry(
  deps: CascadeDependencies,
  entryId: string,
  legalBasis: string,
  requestedBy: string,
): Promise<CascadeResult> {
  const { pool, hmacSecret, findReferencingDocuments, replaceKbReference, notifyDocumentOwner } = deps;

  // 1. Find all documents referencing this KB entry
  const referencingDocs = await findReferencingDocuments(entryId);
  log.info('cascade erasure started', { entryId, affectedCount: referencingDocs.length });

  // 2. Replace KB references in each document
  const affectedDocuments: string[] = [];
  for (const docId of referencingDocs) {
    const replaced = await replaceKbReference(docId, entryId, KB_REMOVED_PLACEHOLDER);
    if (replaced) {
      affectedDocuments.push(docId);
    }
  }

  // 3. Notify document owners
  let notificationsSent = 0;
  for (const docId of affectedDocuments) {
    try {
      await notifyDocumentOwner(
        docId,
        entryId,
        `KB entry ${entryId} was erased under ${legalBasis}. References replaced with "${KB_REMOVED_PLACEHOLDER}".`,
      );
      notificationsSent++;
    } catch (err) {
      log.error('failed to notify document owner', { docId, error: String(err) });
    }
  }

  // 4. Generate cascade attestation
  const details = `Cascade erasure of KB entry ${entryId}. Affected ${affectedDocuments.length} documents. ${notificationsSent} notifications sent.`;
  const attestation = await createAttestation(
    pool,
    hmacSecret,
    entryId,
    'cascade_erasure',
    requestedBy,
    legalBasis,
    details,
  );

  log.info('cascade erasure completed', {
    entryId,
    affected: affectedDocuments.length,
    notifications: notificationsSent,
  });

  return {
    sourceEntryId: entryId,
    affectedDocuments,
    notificationsSent,
    attestation,
  };
}
