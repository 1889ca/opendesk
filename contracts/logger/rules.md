# Contract: Logger

## Purpose

Structured JSON logging with levels, timestamps, correlation IDs, and child logger support. Replaces ad-hoc `console.*` calls across all server-side modules.

## Inputs

- `createLogger(name: string)`: Creates a named logger instance bound to a module.
- `logger.child(context: Record<string, unknown>)`: Creates a child logger with additional bound context.
- `logger.debug/info/warn/error(message: string, context?: Record<string, unknown>)`: Emits a structured log entry.

## Outputs

- JSON lines written to stdout: `{ level, timestamp, module, message, ...context }`
- Error-level logs include stack traces when an `err` field is provided.

## Side Effects

- Writes to `process.stdout` (never to files directly).

## Invariants

- Every log entry is a single JSON line (no multi-line formatting).
- Every log entry includes `level`, `timestamp`, and `module` fields.
- Child loggers inherit all parent context and can add/override fields.
- Log level filtering respects `LOG_LEVEL` env var (default: `info`).
- The logger never throws; logging failures are silently swallowed.

## Dependencies

- `config` — reads `logger.level` from centralized config to resolve the minimum log level at startup. Falls back to `info` if config is unavailable during early bootstrap.

## Boundary Rules

- MUST: output one JSON object per line to stdout.
- MUST: include `level`, `timestamp`, `module` in every entry.
- MUST: support child loggers with inherited context.
- MUST: support `LOG_LEVEL` env var for filtering (debug < info < warn < error).
- MUST NOT: import external npm packages (lightweight, zero third-party deps). Internal module dependency on `config` is permitted for log-level resolution.
- MUST NOT: throw exceptions from any logging method.
- MUST NOT: buffer or batch log output (write immediately).
- MUST NOT: be used in browser-side code (server-only).

## Verification

- Every log entry is valid JSON -> Unit test: parse output of each level method.
- Level filtering works -> Unit test: set LOG_LEVEL=warn, verify debug/info are suppressed.
- Child context is inherited -> Unit test: create child, verify parent fields appear.
- Never throws -> Unit test: pass circular references, verify no exception.
