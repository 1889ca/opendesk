# Contract: ediscovery

## Purpose

eDiscovery export engine for Subject Access Requests (SAR) and FOIA-style document history exports. Enables compliance with GDPR, FOIA, and legal hold requirements.

## Inputs

- SAR export: `{ userId: string }` -- Find all data for a user.
- FOIA export: `{ documentId: string, startDate?: string, endDate?: string }` -- Complete document history.
- Export format: `'json' | 'csv' | 'pdf'` -- Output format.

## Outputs

- `SarExportResult`: `{ userId: string, documents: DocumentSummary[], auditEvents: AuditEntry[], exportedAt: string }` -- All user-related data.
- `FoiaExportResult`: `{ documentId: string, dateRange: { start: string, end: string }, auditTrail: AuditEntry[], versions: VersionSummary[], exportedAt: string }` -- Complete document history.
- `ExportBundle`: `{ format: string, filename: string, data: Buffer | string }` -- Serialized export.

## Side Effects

- Reads from `audit_log`, `documents`, `yjs_update_signatures`, `versions`, `grants` tables.
- Creates export audit events (the export itself is audited).

## Dependencies

- `audit` -- Provides audit log queries.
- `storage` -- Provides document and version queries.
- `permissions` -- Provides grant queries for SAR.
- `events` -- Emits export events for audit trail.

## Boundary Rules

- MUST: Include all audit events for the requested scope.
- MUST: Include Yjs signature verification status in exports.
- MUST: Support JSON, CSV, and PDF output formats.
- MUST: Audit the export itself (who exported what, when).
- MUST: Require admin-level permissions for exports.
- MUST NOT: Include raw private keys in exports.
- MUST NOT: Include data outside the requested scope.
