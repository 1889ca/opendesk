# Known Issues

## Low Priority (Docker-dependent features)

- **Image upload requires S3/MinIO**: The image upload feature requires a running MinIO service. Unavailable without Docker Compose.
- **DOCX/ODT export requires Collabora**: Binary format export requires the Collabora CODE service via Docker. HTML and Text export work client-side without it.
