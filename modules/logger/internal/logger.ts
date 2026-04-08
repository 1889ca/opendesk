/** Contract: contracts/logger/rules.md */

import { LogLevel, type LogLevelName, type Logger, type LogEntry } from '../contract.ts';

/** Resolve the minimum log level from the LOG_LEVEL env var. */
function resolveMinLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return LogLevel[raw as LogLevelName] ?? LogLevel.info;
}

const minLevel = resolveMinLevel();

/** Write a single JSON line to stdout. Never throws. */
function writeEntry(entry: LogEntry): void {
  try {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } catch {
    // Swallow — logging must never crash the process.
  }
}

/** Create a logger instance bound to a module name and optional context. */
function buildLogger(moduleName: string, baseContext: Record<string, unknown>): Logger {
  function emit(level: LogLevelName, message: string, context?: Record<string, unknown>): void {
    if (LogLevel[level] < minLevel) return;

    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      module: moduleName,
      message,
      ...baseContext,
      ...context,
    };

    writeEntry(entry);
  }

  return {
    debug: (msg, ctx) => emit('debug', msg, ctx),
    info: (msg, ctx) => emit('info', msg, ctx),
    warn: (msg, ctx) => emit('warn', msg, ctx),
    error: (msg, ctx) => emit('error', msg, ctx),
    child(context: Record<string, unknown>): Logger {
      return buildLogger(moduleName, { ...baseContext, ...context });
    },
  };
}

/** Factory: create a named logger for a module. */
export function createLogger(name: string): Logger {
  return buildLogger(name, {});
}
