/** Contract: contracts/logger/rules.md */

/** Log levels in ascending severity order. */
export const LogLevel = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const;

export type LogLevelName = keyof typeof LogLevel;

/** Structured log entry written to stdout. */
export interface LogEntry {
  level: LogLevelName;
  timestamp: string;
  module: string;
  message: string;
  [key: string]: unknown;
}

/** Logger interface — all modules depend on this shape. */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

/** Factory signature for creating named loggers. */
export type CreateLogger = (name: string) => Logger;
