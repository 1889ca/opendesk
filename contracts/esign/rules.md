# Contract: esign

## Purpose

Sovereign e-signature workflows: prepare a signing packet, invite signers with ordered or parallel signing, collect signatures via a signing ceremony that proves identity and intent, embed signatures into the PDF, and produce a tamper-evident audit trail that stands up to legal review (eIDAS, E-SIGN Act, PIPEDA).

Signing is cryptographic; identity is pluggable (OIDC, SMS OTP via sovereign provider, or workspace-trusted principal). Long-term validation (LTV) uses timestamps from a workspace-configured TSA.

## Inputs

- `SigningPacket`: { document_id, signers[], order, expiration }
- Signer invitations delivered via email/webhook (email delivery is scaffolded but not a hard dependency — invites can also surface in-app)
- Signing-ceremony inputs: identity challenge response, consent affirmation, signed field positions
- A TSA (Time-Stamping Authority) URL configured at the workspace level

## Outputs

- Signed PDF with embedded PKCS#7 (CAdES-T or PAdES-LTV) signatures
- `SigningAuditTrail` — an append-only, HMAC-chained log (reusing `audit` infrastructure) of: invite sent, invite opened, identity challenge, field positioned, intent affirmed, signature applied, certificate used, TSA response
- `esign.Completed` event upon full packet execution

## Side Effects

- Writes to `storage` (signed PDFs, packet state)
- Writes to `audit` (every ceremony step)
- Calls the configured TSA over HTTPS at signature time
- Invokes `pdf-edit` to place signature fields
- Invokes `notifications` (in-app) and optionally an outbound mailer hook (configurable)

## Invariants

1. **Intent is required.** Every signature requires an affirmative "I agree" action. A checkbox pre-ticked by the author does NOT count. The affirmation text is recorded in the audit trail.
2. **Identity challenge is required.** At least one identity challenge (OIDC login, OTP, or trusted-principal session) completes successfully before a signature can be applied. The challenge type and result are audited.
3. **Signatures are cryptographic.** Every signature is a PKCS#7 detached signature over the document's byte range, not an image of a signature. Image-style visual marks are permitted only as a visual representation of the cryptographic signature.
4. **Tamper evidence.** After signing, any modification to the signed byte range breaks the signature. Subsequent incremental saves (annotations, additional signatures) are accepted; pre-signed bytes are never rewritten.
5. **Timestamp every signature.** A TSA timestamp is requested for every signature. If the TSA is unreachable and the workspace policy requires TSA, the signature fails; policies that permit deferred timestamping enqueue a retry.
6. **Certificate source is auditable.** The signing certificate's issuer, subject, fingerprint, and validity window are recorded. Self-signed certificates are permitted only if workspace policy allows them.
7. **Order enforcement.** Sequential packets do not present the document to signer N+1 until signer N has completed.
8. **Expiration kills the packet.** After `expiration`, the packet is marked expired, no further signatures are accepted, and the audit trail records the timeout.
9. **Revocation before completion.** The packet owner can revoke before all signatures are collected. Already-applied signatures remain valid on a truncated packet; the audit trail records revocation and who signed before it.
10. **No silent re-sends.** Every invite re-send is a new audited event with a new token. Prior tokens are invalidated.

## Dependencies

- `core`
- `storage` — packets, signed PDFs
- `audit` — signing audit trail (separate chain per packet)
- `pdf-edit` — signature field placement
- `events`
- `auth` — principal resolution for in-app signers
- `notifications` — in-app invites
- `app-admin/policy` — TSA URL, allowed cert issuers, self-signed allowance

## Boundary Rules

### MUST

- Record every ceremony step in the signing audit trail with a monotonic index and HMAC chaining
- Use PKCS#7 detached signatures embedded in the PDF via incremental save
- Request a TSA timestamp on every signature (subject to policy)
- Invalidate old invite tokens on re-send
- Enforce signer order for sequential packets
- Capture user-agent, IP, and principal on every ceremony step
- Generate signing tokens with ≥256 bits of entropy

### MUST NOT

- Apply a signature without an explicit intent affirmation
- Accept a signature if the identity challenge failed or is missing
- Re-serialize or rewrite pre-signed byte ranges
- Depend on a cloud-only TSA — workspaces MUST be able to self-host (e.g., FreeTSA-compatible)
- Leak invite tokens in referrer headers (signing pages disable Referer)
- Use weak hash algorithms (SHA-1 or below) anywhere in the signature chain
- Store private keys for the signer (workspace-held certs are for the workspace itself, e.g., witness-signing)

## Verification

1. **Intent required** — attempt to apply a signature without affirmation, assert 400 and audit log records the block.
2. **Identity required** — skip identity step in the ceremony, assert signature refused.
3. **Tamper evidence** — sign PDF, mutate one byte in the signed range, assert signature verification fails.
4. **TSA timestamp** — sign with TSA configured, extract signature, assert timestamp token present and verifiable.
5. **Order enforcement** — sequential packet, attempt signer 2 before signer 1, assert refused.
6. **Expiration** — set expiration to past, attempt to sign, assert refused with `EXPIRED` code.
7. **Revocation** — revoke mid-packet, attempt to sign, assert refused; already-applied signatures still verify.
8. **Audit chain integrity** — mutate a row in the signing audit table, run verification, assert tamper detected.
9. **Token rotation** — re-send invite, assert prior token rejected.

## MVP Scope

Implemented (targeted):
- [ ] `SigningPacket` CRUD
- [ ] In-app signing ceremony (identity via OIDC session)
- [ ] PKCS#7 signature embed via `pdf-edit`
- [ ] TSA client (RFC 3161)
- [ ] Per-packet audit chain
- [ ] Sequential and parallel packets
- [ ] Expiration and revocation

Post-MVP (deferred):
- [ ] SMS-OTP identity challenge (requires sovereign SMS provider)
- [ ] Knowledge-based authentication (KBA) — deliberation needed, high abuse potential
- [ ] Bulk-send templates
- [ ] Long-term validation re-timestamping (LTA) worker
- [ ] Cross-border compliance packs (eIDAS qualified signatures, Swiss ZertES)
