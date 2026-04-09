# Contract: erasure

## Purpose

Resolves the tension between GDPR/PIPEDA data erasure requirements and the HMAC-chained append-only audit trail. Provides erasure bridge records that maintain chain verifiability across content deletions, legal hold enforcement, jurisdiction-aware erasure policies, and selective disclosure proofs for eDiscovery.

## Inputs

- `documentId: string` -- Target document for erasure operations.
- `attestationId: string` -- Links to the erasure attestation that triggered the bridge.
- `legalBasis: string` -- Legal authority (e.g., `GDPR_ART_17`, `PIPEDA_PRINCIPLE_9`, `COURT_ORDER`).
- `jurisdiction: string` -- Jurisdiction code (e.g., `EU`, `CA`, `US_HIPAA`).
- `actorId: string` -- Who initiated the erasure or legal hold.
- `holdType: string` -- Type of legal hold (`litigation`, `regulatory`, `ediscovery`).

## Outputs

- `ErasureBridge` -- Record linking pre-erasure and post-erasure hash states with legal basis and HMAC signature.
- `ChainVerifyResult` -- Extended verification result: `VALID`, `VALID_WITH_ERASURES`, or `TAMPERED`.
- `SelectiveDisclosureProof` -- Cryptographic proof of document existence at a point in time, verifiable without erased content.
- `LegalHold` -- Active hold preventing erasure of a document.
- `ErasureConflict` -- Detected conflict between erasure request and existing holds/exports/filings.
- `JurisdictionPolicy` -- Erasure rules for a specific jurisdiction.

## Side Effects

- Inserts rows into `erasure_bridges` table (append-only).
- Inserts/updates rows in `legal_holds` table.
- Reads from `audit_log` table for chain verification and proof generation.

## Invariants

- Erasure bridges are append-only and HMAC-signed. They cannot be modified or deleted.
- A bridge MUST contain both pre-erasure and post-erasure hashes to maintain chain continuity.
- Chain verification MUST recognize bridge records and validate across erasure gaps.
- Legal holds MUST block erasure execution -- no override without explicit authorization.
- Jurisdiction policies are stateless lookups -- no database storage for policy rules.
- Selective disclosure proofs MUST be verifiable by third parties with only the proof and the HMAC secret.

## Dependencies

- `audit` -- Reads `audit_log` for chain data, uses `computeHash`/`verifyHash` from hmac-chain.
- `events` -- For `DomainEvent` type definitions.
- `config` -- Provides `hmacSecret` for bridge HMAC computation.

## Boundary Rules

- MUST: Insert an erasure bridge whenever content is erased from the audit chain.
- MUST: Include legal basis in every erasure bridge.
- MUST: HMAC-sign bridge records using the same secret as audit entries.
- MUST: Support chain verification across erasure bridges (`VALID_WITH_ERASURES`).
- MUST: Check for legal holds before executing any erasure.
- MUST: Support jurisdiction-aware erasure deadline computation.
- MUST: Generate verifiable selective disclosure proofs.
- MUST NOT: Allow erasure of documents under active legal hold without explicit override.
- MUST NOT: Modify or delete existing erasure bridge records.
- MUST NOT: Store jurisdiction policy rules in the database (stateless lookup only).

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
