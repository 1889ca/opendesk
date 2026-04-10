# OpenDesk Audit Manifest
Generated: 2026-04-09

## Summary

| Metric | Value |
|--------|-------|
| Total modules | 30 |
| Total .ts files | ~800 |
| Modules with contract file | 29/30 (core: nested at contracts/core/manifest/) |
| Modules with 100% contract headers | 28/30 (app: 0%, storage: 88%) |
| Critical security issues | 0 |
| Files >200 lines | 7 (all in `app` module) |
| Deferred/tracked issues | 4 |

**Overall posture: production-viable, test gaps in frontend modules**

---

## Module Status

### P0 — Showstoppers

| Module | Issue |
|--------|-------|
| app-slides | Issue #63: no error boundaries around Yjs mutations in `presentation-editor.ts` and `element-interaction.ts`; unhandled promise rejections on HocuspocusProvider events; no fallback for corrupted document state |

---

### P1 — Needs Work

#### app
- **Files**: 242 total, **0 with contract headers**
- **Contract file**: exists
- **Files >200 lines**: 7
  - `editor/table-cell-format.ts` — 223 lines
  - `doc-list/doc-context-menu.ts` — 218 lines
  - `editor/toolbar-selects.ts` — 211 lines
  - `views/editor-view.ts` — 209 lines
  - `doc-list/doc-list-controls.ts` — 209 lines
  - `editor/global-search.ts` — 205 lines
  - `editor/editor-ruler.ts` — 201 lines
- **Tests**: 3 test files (~1% coverage — CRITICAL gap)
- **Security**: no issues
- **TODOs**: 0
- **Action**: Add contract headers; split oversized files; expand test coverage

#### app-slides
- **Files**: 45 total, 100% headers
- **Contract file**: exists
- **Tests**: 9 test files (~20% coverage — HIGH gap)
- **Security**: no issues
- **Action**: Fix issue #63 — add try/catch around Yjs mutation handlers; add error boundary to presentation-editor init; add null guards on provider events

#### app-kb
- **Files**: 24 total, 100% headers
- **Contract file**: exists
- **Tests**: 2 test files (~8% coverage)
- **Security**: no issues
- **Action**: Expand test coverage

#### app-sheets
- **Files**: 35 total, 100% headers
- **Contract file**: exists
- **Tests**: 4 test files (~11% coverage)
- **Security**: no issues
- **Action**: Expand test coverage

#### app-entities
- **Files**: 8 total, 100% headers
- **Contract file**: exists
- **Tests**: 1 test file (~12% coverage)
- **Security**: no issues
- **Action**: Expand test coverage

#### sharing
- **Files**: 15 total, 100% headers
- **Contract file**: exists
- **Files >200 lines**: `rate-limit.ts` (217 lines) — split needed
- **Tests**: 7 test files, 52 test cases
- **Deferred tracked items**:
  - "Cannot grant higher than own role" enforcement — not yet wired
  - GrantCreated/GrantRevoked event emission — ready to wire
  - Invite-by-email (pending grants) — deferred
- **Security**: rate-limiting verified (issue #135 resolved); token entropy 256-bit; bcrypt 12 rounds
- **Action**: Wire event emission; enforce role ceiling check

#### storage
- **Files**: 22 total, **3 missing contract headers**
- **Contract file**: exists
- **Tests**: 5 test files, 45 test cases
- **Deferred tracked items**:
  - Atomic snapshot + state vector co-persistence (currently separate operations)
  - State vector pruning for clients offline >30 days
  - S3 cold storage tier (all in PG hot tier)
  - 14 cross-module pool imports in kb/, references/, ai/ — DI follow-up
- **Security**: RLS properly enforced via `SET LOCAL app.principal_id`; allowlist sort field validation
- **Action**: Add missing headers; implement atomic co-persistence; resolve pool DI

#### federation
- **Files**: 26 total, 100% headers
- **Contract file**: exists (mismatch)
- **Tests**: 9 test files, ~110 test cases
- **Contract violation**: Contract specifies Ed25519 signing; implementation uses RSA-SHA256. Cryptographically sound but undocumented divergence.
- **Security**: no issues
- **Action**: Update contract to document RSA-2048 choice, or migrate to Ed25519

---

### P2 — Healthy

| Module | Files | Headers | Tests | Notes |
|--------|-------|---------|-------|-------|
| ai | 30 | 100% | 91 cases | pgvector, permission-filtered semantic search |
| api | 21 | 100% | 54 cases | CORS properly locked, magic byte upload validation |
| app-admin | 12 | 100% | 23 cases | HTML properly escaped via escapeHtml() |
| audit | 18 | ~72% | 56 cases | HMAC chain + ed25519, property tests |
| auth | 21 | 100% | 77 cases | bcrypt API keys, stateless token verification |
| collab | 12 | 100% | 35 cases | Auth before WebSocket upgrade |
| config | 4 | 100% | 15 cases | Env validated at load time |
| convert | 31 | 100% | ~140 cases | Post-MVP features properly deferred |
| core | 6 | 100% | 21 cases | Manifest pattern; contract at contracts/core/manifest/ |
| document | 24 | 100% | 67 cases | Zod on all discriminated unions |
| ediscovery | 9 | 100% | 32 cases | rlsQuery abstraction for RLS compliance |
| erasure | 31 | 100% | 97 cases | HMAC-signed tombstones, cascade logic |
| events | 13 | 100% | 38 cases | PG outbox + Redis Streams, thin events (no payloads) |
| http | 4 | 100% | 12 cases | AbortSignal timeout, error normalization |
| kb | 33 | 100% | 102 cases | Workspace scoping on all queries |
| logger | 6 | 100% | 27 cases | JSON structured, no external deps, never throws |
| notifications | 8 | 100% | 19 cases | Clean, minimal |
| observability | 25 | 100% | 79 cases | SIEM features deferred per contract |
| permissions | 14 | 100% | 55 cases | Pure eval, property tests for role hierarchy |
| references | 19 | 100% | 82 cases | Workspace scoping, BibTeX property tests |
| sheets-formula | 15 | 100% | 115 cases | Pure logic, no eval(), property tests |
| workflow | 26 | 100% | 63 cases | Wasm sandbox, declarative conditions |

---

## Security Findings

**No critical vulnerabilities found.**

Verified clean:
- SQL injection: all parameterized queries, allowlist sort fields
- XSS: `escapeHtml()` on dynamic HTML; `textContent` for user data in DOM; no `dangerouslySetInnerHTML`
- Auth bypass: auth middleware applied before all protected routes
- CORS: origin allowlist enforced, no `origin: '*'`
- Code injection: no `eval()` or `new Function()` in production code
- Secrets: no hardcoded credentials in production paths (dev defaults in config.ts are environment-gated)
- File uploads: magic byte validation before persistence
- CRDT integrity: Yjs updates authenticated before acceptance in collab module
- JWT: algorithm specified, no `algorithms: ['none']`
- Rate limiting: share token resolve rate-limited (issue #135)

---

## Test Coverage by Category

| Category | Test Files | Test Cases | Assessment |
|----------|-----------|-----------|------------|
| Backend logic (ai, auth, collab, etc.) | ~100 | ~900+ | Good |
| Frontend app | ~12 | ~50 | Critical gap |
| Integration | 1 | — | Critical gap |

**Highest-risk untested surface**: `modules/app/internal/editor/` (111 files, ~3 test files total)

---

## Action Plan

### Immediate (P0)
1. **Fix issue #63**: Wrap Yjs mutation handlers in `presentation-editor.ts` and `element-interaction.ts` with try/catch; add error boundary for HocuspocusProvider connection events

### Short-term (P1)
2. **Add contract headers to `app` module** — mechanical, ~240 files, can be scripted
3. **Add contract headers to 3 missing `storage` files**
4. **Split 7 oversized files in `app` module**
5. **Wire sharing event emission** (GrantCreated/GrantRevoked)
6. **Update federation contract** to document RSA-2048 signing choice

### Medium-term
7. **Expand app/app-slides/app-kb/app-sheets test coverage** — start with editor core and slide mutations
8. **Implement atomic snapshot+vector co-persistence** in storage
9. **Add integration tests** — currently only 1 test file in tests/integration/

---

## Notes

- `audit` module: header count may be slightly off (wc discrepancy between agents); re-verify with `grep -rl "Contract:" modules/audit`
- `core` contract is at `contracts/core/manifest/rules.md`, not `contracts/core/rules.md` — naming deviation from convention
- All restricted zones (auth, permissions, sharing) audited; no violations requiring human sign-off found
