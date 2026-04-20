# Contract: forms

## Purpose

Form builder and response collector: compose typed surveys (single-line, paragraph, choice, checkbox, scale, date, file upload), share a response link, collect responses into a KB dataset, and view aggregated results. Closes the Microsoft Forms / Google Forms gap.

Forms are OpenDesk-native content (like Documents, Sheets, Slides) but structurally simpler — a flat list of typed questions plus display metadata.

## Inputs

- **Author side**:
  - `FormDefinition` JSON — authored via the form builder UI; persisted as a Yjs document for real-time co-authoring
  - Question types: `short_text`, `long_text`, `single_choice`, `multi_choice`, `scale`, `date`, `file_upload`, `email`, `number`
  - Validation rules per question: required, min/max length, regex (RE2-safe), choice constraints

- **Respondent side**:
  - `FormResponse` submission — JSON payload keyed by question ID, validated against the live `FormDefinition`
  - Optional auth principal (forms may be anonymous, authenticated-only, or link-guarded)

## Outputs

- `FormDefinition` persisted to `storage` with its own ID space (`frm_...`)
- `FormResponse` rows persisted to Postgres (`form_responses` table) AND mirrored into a linked KB dataset (bi-directional with `modules/kb`)
- Aggregated results view: counts, histograms, CSV export
- Share link with role (`view_results | respond | owner`) via `modules/sharing`

## Side Effects

- Emits `FormPublished`, `FormResponseSubmitted`, `FormClosed` events via `events`
- Writes to the audit log (`audit`) on every definition change and response submission
- Creates a KB dataset entry when a form is first published; appends rows as responses arrive

## Invariants

1. **Schema versioning on responses.** Every `FormResponse` records the `FormDefinition.version` it was submitted against. Later schema changes never invalidate past responses.
2. **Required = server-enforced.** Client-side validation is a UX courtesy; the API rejects responses missing required fields regardless of client behavior.
3. **Anonymous is opt-in.** A form MUST default to authenticated-only. Anonymous mode is an explicit toggle, logged as a definition change.
4. **One response per respondent (optional).** When the author sets `single_response = true`, authenticated respondents are keyed by principal and subsequent submissions update their prior response; anonymous forms cannot enforce this and the UI must warn.
5. **File uploads are S3-backed.** `file_upload` answers store an S3 object reference, never inline bytes. Max file size is workspace-policy-bounded (see `app-admin/policy`).
6. **KB dataset parity.** The linked KB dataset's column schema MUST match the `FormDefinition`. Column schema migrations use the same version key as responses.
7. **Closed forms are immutable and write-blocked.** After `close_at` passes or the author closes the form, all POST `/responses` calls return 410.
8. **Erasure participation.** Responses participate in GDPR erasure via `modules/erasure` — tombstone the response, keep the definition.

## Dependencies

- `core` — shared primitives
- `storage` — `FormDefinition` blobs and `form_responses` rows
- `events` — event emission
- `audit` — mutation audit
- `kb` — response dataset sync
- `sharing` — share-link creation and role enforcement
- `erasure` — participates in cascade erasure
- `auth` — principal resolution for authenticated submissions

## Boundary Rules

### MUST

- Validate every incoming `FormResponse` against the current `FormDefinition` schema (Zod)
- Record `definition_version` on every response row
- Emit `FormResponseSubmitted` inside the same transaction as the row insert
- Honor `single_response` idempotency keyed by principal ID
- Reject file uploads above `export.require_approval_over_mb` until approved by policy
- Cap the number of questions per form at 250 (performance guardrail)

### MUST NOT

- Store file bytes in Postgres (S3 only)
- Accept submissions after `close_at` (respond with 410)
- Mutate historic responses when the definition changes
- Evaluate respondent regex validation server-side using unbounded regex engines (RE2-style only)
- Return other respondents' answers via the respondent API (only authors/viewers see results)

## Verification

1. **Schema versioning** — publish v1, collect response, publish v2 with altered question, assert v1 response is still readable and the view distinguishes versions.
2. **Required enforcement** — submit a response missing a required field via raw API, assert 400.
3. **single_response idempotency** — authenticated user submits twice, assert the first row is updated, not duplicated.
4. **File size cap** — upload file above policy threshold, assert 413.
5. **Closed form rejection** — close form, attempt POST, assert 410.
6. **KB dataset parity** — add a question, publish, assert linked dataset's column schema updates.
7. **Erasure cascade** — erase a user, assert their responses are tombstoned and aggregate counts reflect the removal.
8. **Audit coverage** — every definition change and response appears in the audit log with principal attribution.

## MVP Scope

Implemented (targeted):
- [ ] `FormDefinition` Zod schema + Yjs-backed co-authoring
- [ ] Nine question types listed above
- [ ] Public respondent page (anonymous + authenticated)
- [ ] Aggregated results view with CSV export
- [ ] KB dataset mirror
- [ ] Share-link integration

Post-MVP (deferred):
- [ ] Conditional branching (show-if)
- [ ] Multi-page forms with progress bar
- [ ] Response quotas and stop rules
- [ ] Form templates library
- [ ] Payment collection
- [ ] reCAPTCHA-equivalent bot protection (sovereign alternative — deliberation required)
