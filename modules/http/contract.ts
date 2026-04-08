/** Contract: contracts/http/rules.md */

/**
 * Error codes for HTTP fetch failures.
 * - TIMEOUT: request exceeded the configured timeout
 * - NETWORK_ERROR: DNS, connection refused, or other transport failure
 */
export type HttpErrorCode = 'TIMEOUT' | 'NETWORK_ERROR';

/**
 * Extended RequestInit with optional timeout.
 */
export interface HttpFetchInit extends RequestInit {
  /** Timeout in milliseconds. Default: 30000 (30s). */
  timeoutMs?: number;
}
