/** Contract: contracts/logger/rules.md */
export {
  LogLevel,
  type LogLevelName,
  type LogEntry,
  type Logger,
  type CreateLogger,
} from './contract.ts';

export { createLogger } from './internal/logger.ts';
