# Known Issues

## Fixed — 2026-04-07 E2E Test Run

- **CSP blocks inline theme-detection scripts (SHOWSTOPPER)**: The Content Security Policy only allowed `'self'` for `script-src`, but `editor.html`, `index.html`, and `share.html` all contain inline `<script>` blocks for theme flash prevention. This caused CSP violation errors in the browser console. Fixed by adding SHA-256 hashes for both inline script variants to the CSP directive in `modules/api/internal/security.ts`.

- **Frontend crash: "n is not iterable" on API error (SHOWSTOPPER)**: When the API returns an error object (e.g. `{"error":"..."}`) instead of an array, the doc-list page crashed because `folder-list.ts:loadFolders()` and `doc-list.ts:loadAll()` passed the error object directly to `for...of` loops expecting arrays. Fixed by adding `res.ok` checks and `Array.isArray()` guards in both `modules/app/internal/doc-list/doc-list.ts` and `modules/app/internal/doc-list/folder-list.ts`.

## Fixed — 2026-04-07 Docker QA

- **S3 bucket not auto-created on startup (SHOWSTOPPER)**: Fresh Docker deployments had no MinIO bucket, causing all image uploads to fail with "The specified bucket does not exist". Fixed by adding `ensureS3Bucket()` to server startup in `modules/api/internal/s3-client.ts` and calling it from `modules/api/internal/server.ts`. The server now creates the bucket automatically if it doesn't exist.

## Low Priority

- **Upload route default documentId fails validation**: In `modules/api/internal/upload-routes.ts`, the Zod schema uses `.default('general')` but the regex `^[0-9a-f-]+$` rejects non-hex characters. The default is dead code since the frontend always passes a UUID, but the schema is internally inconsistent.
  - Priority: low
  - Steps: POST to `/api/upload` without a `documentId` field
  - Expected: Uses default path prefix for upload
  - Actual: Validation error because 'general' fails the hex-only regex

- **Import round-trip loses list/table structure**: Collabora import of complex DOCX content with lists and tables produces flat paragraphs with raw HTML tag text visible (angle brackets stripped, tag attributes shown as text).
  - Priority: medium
  - Steps: Export a document with `<ul><li>` and `<table>` elements to DOCX, then import it back
  - Expected: Lists and tables preserved as structured TipTap nodes
  - Actual: List items contain raw HTML attribute text; tables flattened to paragraphs

- **Collabora coolmount warnings**: Collabora logs show `coolmount: Operation not permitted` warnings. Does not affect conversion but may indicate suboptimal jail performance.
  - Priority: low
  - Steps: Check `docker compose logs convert`
  - Expected: Clean startup
  - Actual: Repeated coolmount permission warnings

- **E2E tests require docker-compose stack**: The Playwright E2E suite (`e2e/mvp-workflow.spec.ts`) requires PostgreSQL, Redis, and MinIO running via `docker-compose up`. Without these services, 16 of 18 tests fail because: (1) document creation API returns 500, (2) `title-sync.ts` redirects editor to `/` on fetch failure, (3) doc-list shows "load failed" error state. Only the static page-load test ("loads with header and search") and the theme toggle test pass without infrastructure.
  - Priority: medium
  - Steps: Run `npx playwright test` without docker-compose services
  - Expected: Tests pass or are skipped gracefully
  - Actual: 16/18 tests fail with timeouts and missing elements

- **Editor redirects to doc-list on any API error**: `modules/app/internal/shared/title-sync.ts` line 20 does `window.location.href = '/'` on any fetch error, including server 500s. This makes the editor page unreachable whenever the backend database is unavailable, even though the editor could function locally with CRDT-only editing.
  - Priority: medium
  - Steps: Open `/editor.html?doc=any-id` when the database is down
  - Expected: Editor loads with offline/degraded mode indication
  - Actual: Immediately redirects to `/`

- **Server error handler logs empty messages**: `modules/api/internal/server.ts` line 152 logs `err.message` but when database connection errors occur, the message is empty, producing unhelpful `[opendesk] unhandled error:` log lines with no details.
  - Priority: low
  - Steps: Start server without PostgreSQL, make API calls
  - Expected: Descriptive error messages in server logs
  - Actual: Empty error messages logged

## Notes (Docker-dependent features)

- Image upload requires S3/MinIO (now auto-creates bucket on startup)
- DOCX/ODT/PDF export requires Collabora CODE service via Docker
- HTML and Text export work client-side without Docker
