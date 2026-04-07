# Adversarial Code Review — 2026-04-06

**Scope:** Full codebase review after 8-feature parallel sprint
**Reviewers:** 4 parallel adversarial sub-agents (Security, Code Quality, Architecture, Contracts Compliance)

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| CRITICAL | 8 | Unauthenticated WebSocket + convert routes, dev mode bypass, timing-unsafe passwords, dead DocumentRepository, hollow events module |
| HIGH | 15 | SHA-256 passwords, missing auth on sharing, cache poisoning, TOCTOU race, async error handling, incompatible role types, 52% contract compliance |
| MEDIUM | 13 | Scope enforcement absent, SSRF risk, XSS in exports, credential defaults, document enumeration, impure evaluate() |
| LOW | 5 | Info leaks, missing CORS, in-memory defaults, .js import, no explicit body limit |

## Contracts Compliance

**Overall: 49/95 invariants verified (52%)**

| Module | Score | Status |
|--------|-------|--------|
| document | 8/9 | Good — missing property-based tests |
| auth | 9/11 | Good — WebSocket gap is cross-module |
| permissions | 8/9 | Good — missing event emission |
| app | 5/8 | Gaps — no blockId, no permission-driven UI |
| convert | 4/7 | Partial — flush/event emission conditional |
| sharing | 4/11 | Poor — missing grant creation, role validation, events |
| api | 5/12 | Poor — no Zod validation, rate limiting, ETag, SSE |
| collab | 3/15 | Poor — no IntentExecutor, Materializer, journal |
| storage | 2/6 | Poor — DocumentRepository not implemented |
| events | 1/7 | Hollow — types only, zero implementation |

## Issues Created

- #18 — WebSocket collab endpoint has zero authentication (CRITICAL)
- #19 — Convert routes bypass authentication (CRITICAL)
- #20 — AUTH_MODE=dev has no production safeguard (CRITICAL)
- #21 — Share link security: timing, hashing, query param (CRITICAL)
- #22 — Module boundary violations: storage/internal imported directly (CRITICAL)
- #23 — No async error handling on Express routes (HIGH)
- #24 — Idempotency cache key missing user identity (HIGH)
- #25 — StarterKit history: false not undoRedo: false (HIGH)
- #26 — Sharing/permissions incompatible role types (HIGH)
- #27 — Contracts compliance at 52% — descope or implement (HIGH)
