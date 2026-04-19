# Contract: app-admin/policy

## Purpose

Admin control-plane UI for workspace-wide governance policies: retention, export restrictions, DLP keyword rules, watermark templates, sensitivity labels, and branding. This is a sub-contract of `contracts/app-admin/rules.md`. It adds a "Policy" tab to the existing admin dashboard.

Policy *enforcement* lives in other modules (`erasure`, `audit`, `sharing`, `convert`). This module only renders and edits policy documents; it never enforces them.

## Inputs

- `GET /api/admin/policies` — returns the current `WorkspacePolicy` document for the active workspace
- `PUT /api/admin/policies` — persists an edited `WorkspacePolicy`
- User interactions: tab activation, field edits, save, discard, preview

## Outputs

- Rendered "Policy" tab with sections: Retention, Export, DLP, Watermarks, Sensitivity Labels, Branding
- Client-side validation errors surfaced inline
- Success/error toasts on save

## Side Effects

- HTTP PUT to `/api/admin/policies` on save
- Emits `WorkspacePolicyUpdated` event via the backend (not the UI's responsibility to emit; just to display after save)

## Invariants

1. **Render-only.** The UI never evaluates policies against content. Enforcement is a server-side concern.
2. **One policy document per workspace.** The admin UI edits a single `WorkspacePolicy` per workspace. Multi-policy layering (e.g. per-department overrides) is post-MVP.
3. **No mock data.** Real API responses only, matching parent `app-admin/rules.md`.
4. **XSS-safe.** All dynamic fields (keyword lists, watermark text, label names) escaped via `escapeHtml()` before DOM insertion.
5. **Optimistic concurrency.** The policy document carries an `updated_at` timestamp. PUT requests that lose a concurrent-edit race return 409 and the UI shows a reload prompt.
6. **Restricted-zone bridges.** When a policy field has enforcement implications in a restricted module (`auth`, `permissions`, `sharing`), the UI MUST render a read-only banner explaining that the field requires a human-maintainer deploy to take effect.

## Policy Shape

```ts
WorkspacePolicy = {
  workspace_id: string
  retention: {
    documents_days: number | null     // null = forever
    audit_days: number | null
    erasure_grace_days: number
  }
  export: {
    allowed_formats: Array<'pdf' | 'docx' | 'odt' | 'xlsx' | 'ods' | 'pptx' | 'odp'>
    require_approval_over_mb: number | null
  }
  dlp: {
    blocked_keywords: string[]        // case-insensitive substring match, server-side
    blocked_regex: string[]            // RE2-safe patterns only
    action: 'warn' | 'block'
  }
  watermark: {
    enabled: boolean
    text_template: string              // supports {user}, {date}, {doc}
    opacity: number                    // 0.05..0.5
  }
  sensitivity_labels: Array<{
    id: string
    name: string
    color: string                      // hex
    export_blocked: boolean
  }>
  branding: {
    logo_url: string | null
    accent_hex: string | null
    product_name_override: string | null
  }
  updated_at: string                   // ISO 8601
}
```

## Dependencies

- `app-admin/rules.md` (parent)
- `@opendesk/app` — `apiFetch`, `escapeHtml`
- `audit` — policy edits MUST be audited server-side (not the UI's job; flagged here so reviewers see it)

## Boundary Rules

### MUST

- Render every section as an independent panel; each panel saves the full policy document (server MAY diff)
- Validate numeric ranges client-side before PUT (watermark opacity, retention days ≥ 0)
- Show a "Last updated by {user} at {time}" header from the `updated_at` field
- Keep every file under 200 lines (split section panels into separate files)

### MUST NOT

- Evaluate DLP keywords against any content in the browser (server enforces)
- Enforce retention by deleting anything from the UI
- Call restricted-zone modules (`auth`, `permissions`, `sharing`) directly
- Ship default keyword or regex lists that could be mistaken for legal advice

## Verification

1. **Round-trip** — load policy, edit retention, save, reload; assert values persisted.
2. **Optimistic concurrency** — two tabs edit the same policy, second save receives 409; UI shows reload prompt.
3. **Validation** — enter opacity=2.0, assert inline error and save disabled.
4. **Escape** — inject `<img onerror>` into a keyword, assert no script executes and literal characters render.
5. **Restricted banner** — sensitivity label linked to `permissions` enforcement shows the read-only banner.

## Out of Scope (Post-MVP)

- Per-department / per-team policy overlays
- Policy versioning and rollback UI (the server audit log covers history; dedicated UI is post-MVP)
- Policy import/export (JSON round-trip)
- Policy simulation ("would this policy have blocked the last 100 exports?")
