# Contract: convert

## Purpose

Format conversion between office document formats (.docx, .odt, .pdf) and OpenDesk's internal DocumentSnapshot representation, backed by a LibreOffice/Collabora process running in a memory-limited container.

## Inputs

- `importFile(file: Buffer, format: ImportFormat, documentId: string)`: Converts an uploaded file into a valid `DocumentSnapshot` and persists it via `storage`.
- `exportDocument(documentId: string, format: ExportFormat, requestedBy: ActorId)`: Initiates the flush-then-convert pipeline to produce a downloadable file from the current document state.

### ImportFormat

```typescript
type ImportFormat = 'docx' | 'odt' | 'pdf';
```

### ExportFormat

```typescript
type ExportFormat = 'docx' | 'odt' | 'pdf';
```

## Outputs

- `DocumentSnapshot`: Produced by import. Conforms to the `document` module's schema (discriminated on `documentType`, validated by Zod).
- `ExportResult`: Produced by export. Contains the converted file bytes and metadata.

```typescript
type ExportResult = {
  documentId: string;
  format: ExportFormat;
  stale: boolean;         // true if collab did not flush in time
  fileBuffer: Buffer;
  exportedAt: ISOString;
};
```

- `ConversionRequested` event: Emitted when an export is initiated, signaling collab to flush its in-memory state.
- `ExportReady` event: Emitted when the converted file is available for download.

## Side Effects

- Emits `ConversionRequested` event via `events` module -- triggers collab to flush its Yjs state to storage.
- Emits `ExportReady` event via `events` module -- signals that the exported file is available.
- Reads `DocumentSnapshot` from `storage` -- after flush (or after timeout fallback).
- Writes exported files to `storage` -- the converted output is persisted for retrieval.
- Spawns LibreOffice process -- runs inside a memory-limited container for the actual format conversion.

## Invariants

1. **Flush before export.** Every export request emits a `ConversionRequested` event and waits for `StateFlushed` before reading the snapshot. The module never silently exports stale data without marking it.

2. **Stale flag is honest.** If `StateFlushed` is not received within the configured timeout (default: 10 seconds), the module reads the last materialized snapshot from storage and sets `stale: true` on the `ExportResult`. If flush succeeds, `stale` is `false`.

3. **Import produces valid snapshots.** Every `DocumentSnapshot` produced by import passes `DocumentSnapshotSchema.parse()` from the `document` module. No partial or schema-violating snapshots are persisted.

4. **LibreOffice runs memory-limited.** The LibreOffice/Collabora process runs in a container or cgroup with explicit memory limits. The convert module itself enforces this via its Docker Compose service definition (not via application code).

5. **No materializer.** The convert module never runs a Yjs materializer. It reads already-materialized `DocumentSnapshot` data from `storage`. The collab module owns materialization.

6. **No long-lived connections.** The convert module communicates with other modules exclusively via events and storage reads/writes. It does not hold open WebSocket connections, gRPC streams, or persistent HTTP connections to other modules.

7. **ExportReady is always emitted.** Every export request eventually emits an `ExportReady` event -- whether the export succeeded, used a stale snapshot, or failed. The event signals completion, and downstream consumers check the result for errors or staleness.

## Dependencies

- `document` -- `DocumentSnapshot` type, `DocumentSnapshotSchema` for validation of import output, `TextSchemaVersion.current` for setting schema version on imported documents.
- `storage` -- read snapshots after collab flush, write exported files, read uploaded files for import.
- `events` -- emit `ConversionRequested` and `ExportReady` events, subscribe to `StateFlushed` events from collab.

## Boundary Rules

### MUST

- Request a flush before export by emitting `ConversionRequested` and waiting for `StateFlushed`.
- Handle flush timeout gracefully: fall back to the last materialized snapshot with `stale: true` on the result.
- Run LibreOffice in a memory-limited container (enforced via Docker Compose `mem_limit` / `deploy.resources.limits.memory`).
- Produce a valid `DocumentSnapshot` on import (passes `DocumentSnapshotSchema.parse()`).
- Emit `ExportReady` event when conversion completes (success, stale, or failure).
- Set `stale: false` when the snapshot was freshly flushed, `stale: true` when using a fallback snapshot.
- Validate import file format before attempting conversion (reject unsupported formats with a clear error).
- Register `ConversionRequested` and `ExportReady` in the events schema registry at startup.

### MUST NOT

- Implement its own Yjs materializer (collab owns materialization; convert reads materialized snapshots from storage).
- Hold long-lived connections to other modules (no WebSockets, no gRPC streams, no persistent HTTP connections).
- Export stale data without the `stale: true` flag (silent staleness is a data integrity violation).
- Assume LibreOffice is always available (handle process crashes, timeouts, and OOM kills gracefully).
- Import or depend on Yjs, Y.Doc, or any CRDT library (convert operates on DocumentSnapshot, not CRDT state).
- Write directly to the document's CRDT state (import creates a new DocumentSnapshot via storage, not via collab).

## Verification

How to test each invariant:

1. **Flush before export** -- Integration test: trigger an export, verify `ConversionRequested` event is emitted before any snapshot read occurs. Mock the events module and assert the ordering of calls.

2. **Stale flag accuracy** -- Integration test: trigger an export with `StateFlushed` arriving within timeout, assert `stale: false`. Trigger another export where `StateFlushed` never arrives, assert `stale: true` and that the last materialized snapshot was used.

3. **Import schema validity** -- Property-based test: generate various valid .docx/.odt files, run import, verify every output passes `DocumentSnapshotSchema.parse()`. Unit test: verify import rejects corrupt or empty files with a clear error.

4. **Memory-limited container** -- Infrastructure test: verify the Docker Compose service definition for convert includes `mem_limit` or `deploy.resources.limits.memory`. Runtime test: feed LibreOffice a pathologically large file and verify the container is killed rather than consuming unbounded memory.

5. **No materializer** -- Static analysis: verify no import of Yjs, Y.Doc, or materializer code exists in the convert module's source files. Code review: grep for `Y.Doc`, `Y.XmlFragment`, `yjs` in the module directory.

6. **No long-lived connections** -- Code review: verify the module has no WebSocket client instantiation, no gRPC channel creation, no HTTP keep-alive pools to other modules. All inter-module communication is via events (fire-and-forget emit + subscription callbacks) and storage (stateless read/write).

7. **ExportReady always emitted** -- Integration test: trigger exports under three conditions (successful flush, timeout fallback, LibreOffice crash). Verify `ExportReady` is emitted in all three cases.

## File Structure

```
modules/convert/
  contract.ts          -- Zod schemas for ImportFormat, ExportFormat, ExportResult
  index.ts             -- re-exports public API
  internal/
    importer.ts        -- file-to-DocumentSnapshot conversion logic
    exporter.ts        -- flush-wait-convert pipeline for export
    libreoffice.ts     -- LibreOffice process management and invocation
    formats.ts         -- format detection and validation
```

## Docker Compose Service

```yaml
services:
  convert:
    image: opendesk/convert:latest
    mem_limit: 2g
    memswap_limit: 2g
    environment:
      - FLUSH_TIMEOUT_MS=10000
    depends_on:
      - storage
      - events
```

The memory limit is a hard requirement per Decision #003. LibreOffice will OOM a shared host without explicit cgroup limits.

## MVP Scope

Implemented:
- [x] Import: file-to-DocumentSnapshot conversion (docx, odt, pdf)
- [x] Export: DocumentSnapshot-to-file conversion (docx, odt, pdf)
- [x] LibreOffice process management in memory-limited container
- [x] Import produces valid `DocumentSnapshot` (schema-validated)
- [x] Stale flag on export results
- [x] No Yjs/CRDT dependency (operates on DocumentSnapshot only)
- [x] No long-lived connections to other modules

Post-MVP (deferred):
- [ ] Flush-before-export via `ConversionRequested` event — requires events module; currently reads last materialized snapshot directly
- [ ] `ExportReady` event emission — requires events module implementation
- [ ] `ConversionRequested` event emission — requires events module implementation
- [ ] Event schema registry registration at startup — requires events module
