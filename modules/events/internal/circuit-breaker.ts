/** Contract: contracts/events/rules.md */
import { createLogger } from '../../logger/index.ts';

const log = createLogger('events:circuit-breaker');

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Consecutive failures before opening the circuit. */
  maxFailures: number;
  /** Initial backoff in ms after a failure. */
  initialBackoffMs: number;
  /** Maximum backoff ceiling in ms. */
  maxBackoffMs: number;
  /** How often (ms) to probe Redis when the circuit is open. */
  probeIntervalMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxFailures: 10,
  initialBackoffMs: 1000,
  maxBackoffMs: 30_000,
  probeIntervalMs: 60_000,
};

export interface CircuitBreaker {
  /** Current circuit state. */
  state(): CircuitState;
  /** Record a successful operation — resets failure count, closes circuit. */
  recordSuccess(): void;
  /** Record a failure. Returns the backoff ms to wait, or null if circuit just opened. */
  recordFailure(error: unknown): { backoffMs: number } | { opened: true };
  /** Get the probe interval for open-circuit recovery attempts. */
  probeIntervalMs(): number;
  /** Reset the breaker to closed state. */
  reset(): void;
}

export function createCircuitBreaker(
  label: string,
  overrides?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  let consecutiveFailures = 0;
  let currentState: CircuitState = 'closed';
  let currentBackoffMs = config.initialBackoffMs;

  function state(): CircuitState {
    return currentState;
  }

  function recordSuccess(): void {
    const wasOpen = currentState !== 'closed';
    consecutiveFailures = 0;
    currentBackoffMs = config.initialBackoffMs;
    currentState = 'closed';
    if (wasOpen) {
      log.info('circuit closed — consumer resuming', { label });
    }
  }

  function recordFailure(error: unknown): { backoffMs: number } | { opened: true } {
    consecutiveFailures += 1;
    const errStr = error instanceof Error ? error.message : String(error);

    if (consecutiveFailures >= config.maxFailures && currentState !== 'open') {
      currentState = 'open';
      log.error('circuit breaker open — consumer stopped', {
        label,
        consecutiveFailures,
        lastError: errStr,
      });
      return { opened: true };
    }

    const backoffMs = currentBackoffMs;
    currentBackoffMs = Math.min(currentBackoffMs * 2, config.maxBackoffMs);

    log.warn('consumer read failure — backing off', {
      label,
      consecutiveFailures,
      backoffMs,
      error: errStr,
    });

    return { backoffMs };
  }

  function probeIntervalMs(): number {
    return config.probeIntervalMs;
  }

  function reset(): void {
    consecutiveFailures = 0;
    currentBackoffMs = config.initialBackoffMs;
    currentState = 'closed';
  }

  return { state, recordSuccess, recordFailure, probeIntervalMs, reset };
}
