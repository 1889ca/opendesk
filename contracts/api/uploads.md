# Uploads Contract

## Purpose

File upload endpoint with type validation and S3 storage, plus a secure file-serving endpoint for retrieving uploaded files.

## Inputs / Outputs

**Upload endpoint:**

| Method | Path | Auth | Input | Output |
|--------|------|------|-------|--------|
| POST | `/api/upload` | none | multipart `file` + optional `documentId` | `{ url, key, contentType, size }` |

**File serving endpoint:**

| Method | Path | Auth | Output |
|--------|------|------|--------|
| GET | `/api/files/:key(*)` | none | file stream with security headers |

## Invariants

### Upload

- MUST: accept only `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- MUST: reject files exceeding 10 MB
- MUST: validate `documentId` matches `/^[0-9a-f-]+$/i` or is literal `"general"`
- MUST: store files under S3 key `uploads/{documentId}/{uuid}.{ext}`
- MUST: generate a UUID v4 per upload (content-addressed, immutable)
- MUST: return the serving URL as `/api/files/{key}`
- MUST NOT: accept arbitrary MIME types

### File Serving

- MUST: restrict key prefix to `uploads/` — reject paths not starting with `uploads/`
- MUST: reject paths containing `..` (path traversal) with 403
- MUST: set `X-Content-Type-Options: nosniff` on all responses
- MUST: set `Content-Disposition: inline` for images, `attachment` for other types
- MUST: set `Cache-Control: public, max-age=31536000, immutable` (1-year cache)
- MUST: stream the S3 response body (not buffer in memory)
- MUST: return 404 for `NoSuchKey` errors

### S3 Client

- MUST: require `S3_ACCESS_KEY` and `S3_SECRET_KEY` in production (throws on startup if missing)
- MUST: use `forcePathStyle: true` for MinIO compatibility
- Defaults: endpoint `http://localhost:9000`, bucket `opendesk`, region `us-east-1`

## Dependencies

- `@aws-sdk/client-s3` — S3 PutObject and GetObject operations
- `multer` — multipart form parsing with memory storage

## Verification

- Unit test: upload unsupported MIME type returns error
- Unit test: upload exceeding 10 MB returns error
- Unit test: `documentId` with `..` or special chars returns 400
- Unit test: file serving with `..` in key returns 403
- Unit test: file serving for missing key returns 404
- Integration test: upload image, retrieve via file serving endpoint, verify content matches

## MVP Scope

Implemented:
- [x] Image upload with MIME type whitelist (png, jpeg, gif, webp)
- [x] 10 MB size limit via multer
- [x] S3 storage with UUID-based keys under `uploads/` prefix
- [x] Secure file serving with path traversal protection
- [x] Security headers (nosniff, Content-Disposition, immutable caching)
- [x] S3 client with dev defaults and production credential enforcement
