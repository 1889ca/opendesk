# Contract: pdf-edit

## Purpose

Native PDF annotation and form-fill editor. Today OpenDesk only *converts* PDFs (via `convert`/Collabora); this module lets users open a PDF, draw annotations (highlight, underline, strike, freehand, text box, stamp), fill AcroForm and XFA fields, redact regions, and save back as a valid PDF without round-tripping through LibreOffice.

This is a complement to — not a replacement for — `convert`. Conversion remains the path for `docx ↔ pdf`; this module is for editing PDFs as PDFs.

## Inputs

- Source PDF bytes from `storage` (uploaded or converted)
- User actions: annotate, fill field, redact region, sign block placement (delegates the signature ceremony to `esign`)
- Save command — produces a new PDF derived from the source

## Outputs

- `PdfAnnotationLayer` — a Yjs-backed overlay document that holds annotations as structured objects (not baked into the PDF until save)
- On save: a new PDF with annotations flattened OR preserved as incremental-save annotations (author choice)
- Redacted PDF with content removed from the content stream (not just visually obscured)

## Side Effects

- Reads and writes to `storage`
- Emits `PdfAnnotated`, `PdfRedacted`, `PdfSaved` events
- Writes audit entries for every redaction (redactions are irreversible and must be provable)
- May invoke `convert` when the source is not a PDF (e.g., opening a .docx in annotate mode — convert first, then annotate)

## Invariants

1. **Annotations are overlays until save.** Annotations live in a Yjs overlay document co-authored in real time. The underlying PDF bytes are immutable until the user explicitly saves.
2. **Redactions remove content.** A redaction MUST remove the underlying glyphs/images from the PDF content stream, not merely draw a black box. This is verified by a post-save text-extraction pass that asserts the redacted string is absent.
3. **Incremental save by default.** The saved PDF uses PDF incremental update (append) so the original signed byte range, if any, remains valid. Flattening is opt-in.
4. **Signature fields are delegated.** This module places and visualizes signature fields; it does NOT compute signatures. Actual signing is owned by `esign`.
5. **Form fields preserve metadata.** AcroForm field values survive save. Field name, type, and flags are never mutated without author confirmation.
6. **No JavaScript execution.** PDF embedded JavaScript is stripped on open and never re-serialized.
7. **No font exfiltration.** External font URLs referenced by the PDF are never fetched; only embedded fonts render. Missing fonts fall back to a bundled permissive font.
8. **File size cap.** Sources above the workspace's `export.require_approval_over_mb` threshold require admin approval before opening (policy bridge).

## Dependencies

- `core`
- `storage` — source and saved PDFs
- `collab` — Yjs co-authoring of the annotation overlay
- `events`
- `audit` — redactions and saves
- `esign` — signature placement delegates to this module
- `convert` — non-PDF sources are converted first
- `app-admin/policy` — size caps and redaction policy

## Boundary Rules

### MUST

- Strip embedded JavaScript from opened PDFs
- Validate incremental updates preserve the original byte range
- Audit every redaction with region coordinates and principal
- Use a pinned, sandbox-safe PDF parser (deliberation required before choosing — see Out of Scope)
- Verify redacted text is absent via a text-extraction check before returning success

### MUST NOT

- Fetch external resources referenced by the PDF (fonts, images, JS, form submit URLs)
- Silently alter AcroForm field names or flags
- Bake annotations during every edit — only at save time
- Execute any script, Lua, or post-script instructions embedded in the PDF
- Store PDF bytes in Postgres (S3 only; metadata in Postgres)

## Verification

1. **Redaction removes content** — redact region with known text, save, extract text via independent tool, assert redacted string is absent.
2. **Incremental save integrity** — open signed PDF, add annotation, save incrementally, assert original signature byte range still validates.
3. **JavaScript strip** — open PDF with embedded JS, assert serialized output has no `/JavaScript` or `/JS` actions.
4. **External fetch block** — open PDF with external font URL, monitor network, assert no outbound request.
5. **Form field preservation** — fill AcroForm field, save, reopen, assert value retained and flags unchanged.
6. **Overlay isolation** — two users annotate the same PDF, assert overlays merge via CRDT without corrupting source bytes.
7. **Audit redaction** — perform redaction, query audit log, assert entry with coordinates + principal.

## MVP Scope

Implemented (targeted):
- [ ] Open PDF, render page by page (canvas)
- [ ] Annotations: highlight, underline, strike, freehand, text box
- [ ] AcroForm field fill
- [ ] Redaction with content-stream removal
- [ ] Incremental save and flatten-on-save options
- [ ] Co-authoring of the annotation overlay via Yjs

Post-MVP (deferred):
- [ ] XFA form support (XFA is being phased out by Adobe; revisit only if customer demand)
- [ ] OCR of scanned PDFs (defer — consider integration with sovereign OCR stack)
- [ ] PDF/A-3 export compliance
- [ ] Annotation templates and stamps library
- [ ] Collaborative review rounds with accept/reject
