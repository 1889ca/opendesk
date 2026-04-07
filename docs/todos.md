# Known Issues

## Medium Priority

- **Share links use in-memory store**: Share links and permission grants use in-memory stores that lose data on server restart. Needs PostgreSQL-backed stores for production.

## Low Priority

- **Image upload requires S3/MinIO**: The image upload feature requires a running MinIO service. Unavailable without Docker Compose.
- **DOCX/ODT export requires Collabora**: Binary format export requires the Collabora CODE service via Docker. HTML and Text export work client-side without it.
- **Test data accumulation**: E2E test documents are not cleaned up after test runs. Needs a cleanup step in the test harness.
