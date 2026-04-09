# Contract: erasure

## Purpose

Resolves the tension between GDPR/PIPEDA data erasure requirements and the HMAC-chained append-only audit trail. Provides GDPR-compliant data erasure tooling for Yjs CRDT documents (tombstone extraction, structural anonymization, targeted redaction, KB cascade erasure, policy-driven automated pruning), plus erasure bridge records that maintain chain verifiability across content deletions, legal hold enforcement, jurisdiction-aware erasure policies, and selective disclosure proofs for eDiscovery.

## Inputs

- `documentId: string` -- Target document for erasure operations.
- `attestationId: string` -- Links to the erasure attestation that triggered the bridge.
- `legalBasis: string` -- Legal authority (e.g., `GDPR_ART_17`, `PIPEDA_PRINCIPLE_9`, `COURT_ORDER`).
- `jurisdiction: string` -- Jurisdiction code (e.g., `EU`, `CA`, `US_HIPAA`).
- `actorId: string` -- Who initiated the erasure or legal hold.
- `holdType: string` -- Type of legal hold (`litigation`, `regulatory`, `ediscovery`).
- `targetUserId: string` -- User whose data should be erased/anonymized.
- `pattern: string` -- Content pattern for targeted redaction (optional, alternative to userId).
- `retentionPolicy: RetentionPolicy` -- Rule definition for automated pruning.
- `crdtState: Uint8Array` -- Raw Yjs document state for tombstone operations.

## Outputs

- `ErasureBridge` -- Record linking pre-erasure and post-erasure hash states with legal basis and HMAC signature.
- `ChainVerifyResult` -- Extended verification result: `VALID`, `VALID_WITH_ERASURES`, or `TAMPERED`.
- `SelectiveDisclosureProof` -- Cryptographic proof of document existence at a point in time, verifiable without erased content.
- `LegalHold` -- Active hold preventing erasure of a document.
- `ErasureConflict` -- Detected conflict between erasure request and existing holds/exports/filings.
- `JurisdictionPolicy` -- Erasure rules for a specific jurisdiction.
- `ErasureAttestation` -- Cryptographic proof of erasure with HMAC hash.
- `TombstoneReport` -- Report of all tombstoned content in a document.
- `AnonymizationResult` -- Result of structural anonymization preserving CRDT integrity.
- `RedactionResult` -- Result of targeted redaction with attestation.
- `CascadeResult` -- Result of KB cascade erasure.
- `PrunePreview` / `PruneResult` -- Preview or result of policy-driven pruning.

## Side Effects

- Inserts rows into `erasure_bridges` table (append-only).
- Inserts/updates rows in `legal_holds` table.
- Reads from `audit_log` table for chain verification and proof generation.
- Creates erasure attestation records in `erasure_attestations` table.
- Modifies Yjs document state (zero-fills tombstone payloads, redacts content).
- Emits `ErasureCompleted` events via EventBus.
- Sends notifications to document owners during cascade erasure.
- Archives tombstone data to sealed storage before purging.

## Invariants

- Erasure bridges are append-only and HMAC-signed. They cannot be modified or deleted.
- A bridge MUST contain both pre-erasure and post-erasure hashes to maintain chain continuity.
- Chain verification MUST recognize bridge records and validate across erasure gaps.
- Legal holds MUST block erasure execution -- no override without explicit authorization.
- Jurisdiction policies are stateless lookups -- no database storage for policy rules.
- Selective disclosure proofs MUST be verifiable by third parties with only the proof and the HMAC secret.
- Every erasure operation MUST produce an attestation with HMAC hash.
- Anonymization MUST preserve CRDT vector clocks and structural pointers.
- Tombstone extraction MUST run before anonymization (archive-then-purge).
- Cascade erasure MUST replace KB references with "[Removed]" placeholder, never silently delete.
- No erasure operation may run without a `legalBasis` string.

## Dependencies

- `audit` -- Reads `audit_log` for chain data, uses `computeHash`/`verifyHash` from hmac-chain.
- `collab` -- Provides Yjs document state access and compaction utilities.
- `events` -- For `DomainEvent` type definitions, emits erasure domain events.
- `config` -- Provides `hmacSecret` for bridge HMAC computation.
- `storage` -- Archives sealed tombstone data.
- `permissions` -- Gates erasure endpoints to admin/owner roles.

## Boundary Rules

- MUST: Insert an erasure bridge whenever content is erased from the audit chain.
- MUST: Include legal basis in every erasure bridge.
- MUST: HMAC-sign bridge records using the same secret as audit entries.
- MUST: Support chain verification across erasure bridges (`VALID_WITH_ERASURES`).
- MUST: Check for legal holds before executing any erasure.
- MUST: Support jurisdiction-aware erasure deadline computation.
- MUST: Generate verifiable selective disclosure proofs.
- MUST: Generate cryptographic attestation for every erasure.
- MUST: Preserve CRDT structural integrity during anonymization.
- MUST: Archive tombstones before purging.
- MUST: Notify affected document owners during cascade erasure.
- MUST: Support dry-run mode for retention policy pruning.
- MUST NOT: Allow erasure of documents under active legal hold without explicit override.
- MUST NOT: Modify or delete existing erasure bridge records.
- MUST NOT: Store jurisdiction policy rules in the database (stateless lookup only).
- MUST NOT: Silently delete content without audit trail.
- MUST NOT: Break CRDT sync capability (vector clocks must remain valid).

## Verification

- Bridge creation: Create a bridge, verify its HMAC signature matches recomputation.
- Chain verification with bridges: Build a chain, insert a bridge, verify result is `VALID_WITH_ERASURES`.
- Chain verification without bridges: Verify an intact chain returns `VALID`.
- Tampered chain: Break a chain without a bridge, verify result is `TAMPERED`.
- Legal hold blocking: Create a hold, attempt erasure, verify it is blocked.
- Legal hold release: Release a hold, verify erasure proceeds.
- Conflict detection: Create holds and verify all conflict types are detected.
- Jurisdiction policies: Verify correct deadlines for GDPR, PIPEDA, HIPAA.
- Selective disclosure proof: Generate proof, verify it independently.
- CRDT integrity: Anonymize a document, verify other clients can still sync.
- Attestation chain: Perform erasure, verify attestation hash is valid HMAC.
- Cascade completeness: Erase a KB entry, verify all referencing documents are updated.
- Dry-run accuracy: Run prune in dry-run, compare output to actual prune results.
- Tombstone extraction: Insert + delete content in Yjs doc, verify tombstones are reported.

## MVP Scope

Implemented:
- [x] Erasure bridge creation and HMAC signing
- [x] Redaction-aware chain verification (VALID / VALID_WITH_ERASURES / TAMPERED)
- [x] Legal hold CRUD and conflict detection
- [x] Jurisdiction-aware erasure policies (GDPR, PIPEDA, HIPAA)
- [x] Selective disclosure proof generation and verification
- [x] Migration for erasure_bridges and legal_holds tables
- [x] Permission-gated API routes for all erasure operations
- [x] 36 contract and unit tests
