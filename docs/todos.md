# Known Issues

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

## Notes (Docker-dependent features)

- Image upload requires S3/MinIO (now auto-creates bucket on startup)
- DOCX/ODT/PDF export requires Collabora CODE service via Docker
- HTML and Text export work client-side without Docker
