# Adversarial Code Review Pass 2 — 2026-04-07

**Scope:** All new code since pass 1 (tables, images, comments, suggestions, search, print, accessibility, mobile, templates, admin routes, purge compaction)
**Reviewers:** Security, Code Quality, Architecture, Contracts Compliance

## Results

| Severity | Found | Fixed |
|----------|-------|-------|
| Critical | 3 | 3 (PR #48) |
| High | 7 | 7 (PR #48) |
| Medium | 8 | 7 (PR #48) |
| Low | 2 | 0 (backlog) |

## Key findings (all fixed)
- Admin purge endpoint had no admin/self check → self-only restriction added
- File serving was an open S3 proxy → key prefix validation + security headers
- Template routes had no authorization → auth guards added
- S3/PG had no production credential guards → throw on missing env vars
- Search regex was vulnerable to ReDoS → nested quantifier rejection
- Suggestion sidebar re-rendered on every transaction → docChanged filter
- timeAgo utility was triplicated → extracted shared module

## Contracts Compliance
Previous: 49/95 (52%) → Current: 63/105 (60%)

## Improvement vs Pass 1
- Pass 1: 8 critical, 15 high (systemic issues — unauthenticated WebSocket, missing error handling)
- Pass 2: 3 critical, 7 high (narrower — authorization gaps on new endpoints, file serving)
- Module boundaries held: zero cross-module internal/ imports found
- Each pass gets cleaner
