/**
 * Collab Stress Test — shared configuration, types, and helpers.
 */

// ── Config ────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

export const USER_COUNT = parseInt(flag('users', '10'), 10);
export const DURATION_S = parseInt(flag('duration', '30'), 10);
export const DOC_ID = flag('doc', `stress-${crypto.randomUUID().slice(0, 8)}`);
export const WS_URL = flag('url', 'ws://localhost:3000/collab');
export const TYPING_MS = parseInt(flag('typing-ms', '100'), 10);

// ── Types ─────────────────────────────────────────────
export interface UserMetrics {
  userId: number;
  connected: boolean;
  connectTimeMs: number;
  charsTyped: number;
  updatesReceived: number;
  errors: string[];
}

export interface HttpMetrics {
  requests: number;
  failures: number;
  latencies: number[];
}

// ── Helpers ───────────────────────────────────────────
const WORDS = [
  'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'hello', 'world',
  'document', 'editor', 'collaboration', 'real-time', 'sync',
];

export function randomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const s = [...sorted].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * s.length) - 1;
  return s[Math.max(0, idx)];
}
