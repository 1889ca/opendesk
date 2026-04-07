/**
 * Collab Stress Test — simulates N concurrent users editing a document.
 *
 * Each simulated user:
 * 1. Connects to the Hocuspocus WebSocket server
 * 2. Types random words into the shared Yjs document
 * 3. Reports latency and sync metrics
 *
 * Usage:
 *   npx tsx stress/collab-stress.ts [options]
 *
 * Options:
 *   --users N       Number of concurrent users (default: 10)
 *   --duration S    Test duration in seconds (default: 30)
 *   --doc ID        Document ID to use (default: random UUID)
 *   --url URL       WebSocket URL (default: ws://localhost:3000/collab)
 *   --typing-ms N   Interval between keystrokes in ms (default: 100)
 */

import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

// Polyfill WebSocket for Node.js (HocuspocusProvider expects a browser WebSocket)
Object.assign(globalThis, { WebSocket });

// ── Config ────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const USER_COUNT = parseInt(flag('users', '10'), 10);
const DURATION_S = parseInt(flag('duration', '30'), 10);
const DOC_ID = flag('doc', `stress-${randomUUID().slice(0, 8)}`);
const WS_URL = flag('url', 'ws://localhost:3000/collab');
const TYPING_MS = parseInt(flag('typing-ms', '100'), 10);

// ── Metrics ───────────────────────────────────────────
interface UserMetrics {
  userId: number;
  connected: boolean;
  connectTimeMs: number;
  charsTyped: number;
  updatesReceived: number;
  errors: string[];
}

const metrics: UserMetrics[] = [];
const WORDS = [
  'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'hello', 'world',
  'document', 'editor', 'collaboration', 'real-time', 'sync',
];

function randomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

// ── Simulated User ────────────────────────────────────
function spawnUser(userId: number): Promise<UserMetrics> {
  return new Promise((resolve) => {
    const m: UserMetrics = {
      userId,
      connected: false,
      connectTimeMs: 0,
      charsTyped: 0,
      updatesReceived: 0,
      errors: [],
    };
    metrics.push(m);

    const ydoc = new Y.Doc();
    const connectStart = Date.now();
    let typingInterval: ReturnType<typeof setInterval> | null = null;

    const provider = new HocuspocusProvider({
      url: WS_URL,
      name: DOC_ID,
      document: ydoc,
      token: 'dev',
      onConnect() {
        m.connected = true;
        m.connectTimeMs = Date.now() - connectStart;

        // Start typing random content
        const text = ydoc.getXmlFragment('default');
        typingInterval = setInterval(() => {
          try {
            ydoc.transact(() => {
              const word = randomWord() + ' ';
              const textNode = new Y.XmlText(word);
              const pos = Math.min(text.length, Math.floor(Math.random() * (text.length + 1)));
              text.insert(pos, [textNode]);
              m.charsTyped += word.length;
            });
          } catch (err) {
            m.errors.push(`type error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }, TYPING_MS);
      },
      onDisconnect() {
        if (!m.connected) {
          m.errors.push('disconnected before connecting');
        }
      },
    });

    // Count remote updates
    ydoc.on('update', () => {
      m.updatesReceived++;
    });

    // Stop after duration
    setTimeout(() => {
      if (typingInterval) clearInterval(typingInterval);
      provider.disconnect();
      ydoc.destroy();
      resolve(m);
    }, DURATION_S * 1000);
  });
}

// ── HTTP Stress ───────────────────────────────────────
interface HttpMetrics {
  requests: number;
  failures: number;
  latencies: number[];
}

async function stressHttp(): Promise<HttpMetrics> {
  const base = WS_URL.replace('ws://', 'http://').replace('wss://', 'https://').replace('/collab', '');
  const m: HttpMetrics = { requests: 0, failures: 0, latencies: [] };
  const endTime = Date.now() + DURATION_S * 1000;

  const endpoints = [
    { method: 'GET', url: `${base}/api/health` },
    { method: 'GET', url: `${base}/api/documents` },
  ];

  while (Date.now() < endTime) {
    const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
    const start = Date.now();
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: { Authorization: 'Bearer dev' },
      });
      m.latencies.push(Date.now() - start);
      m.requests++;
      if (!res.ok) m.failures++;
    } catch {
      m.failures++;
      m.requests++;
    }
    // Small delay to avoid pure spin-loop
    await new Promise(r => setTimeout(r, 10));
  }

  return m;
}

// ── Main ──────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║          OpenDesk Stress Test                   ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Users:     ${String(USER_COUNT).padEnd(37)}║`);
  console.log(`║  Duration:  ${String(DURATION_S + 's').padEnd(37)}║`);
  console.log(`║  Document:  ${DOC_ID.padEnd(37)}║`);
  console.log(`║  WS URL:    ${WS_URL.padEnd(37)}║`);
  console.log(`║  Typing:    ${String(TYPING_MS + 'ms interval').padEnd(37)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log();

  // Spawn all users + HTTP stress in parallel
  console.log(`Spawning ${USER_COUNT} collab users + HTTP load...`);
  const startTime = Date.now();

  const userPromises = Array.from({ length: USER_COUNT }, (_, i) => spawnUser(i));
  const httpPromise = stressHttp();

  // Progress reporter
  const progress = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const connected = metrics.filter(m => m.connected).length;
    const totalChars = metrics.reduce((s, m) => s + m.charsTyped, 0);
    process.stdout.write(`\r  [${elapsed}s] ${connected}/${USER_COUNT} connected, ${totalChars} chars typed`);
  }, 1000);

  const [userResults, httpResult] = await Promise.all([
    Promise.all(userPromises),
    httpPromise,
  ]);
  clearInterval(progress);
  console.log('\n');

  // ── Report ────────────────────────────────────────
  const totalDuration = (Date.now() - startTime) / 1000;
  const connected = userResults.filter(u => u.connected).length;
  const totalChars = userResults.reduce((s, u) => s + u.charsTyped, 0);
  const totalUpdates = userResults.reduce((s, u) => s + u.updatesReceived, 0);
  const connectTimes = userResults.filter(u => u.connected).map(u => u.connectTimeMs);
  const allErrors = userResults.flatMap(u => u.errors);

  const p50 = percentile(connectTimes, 50);
  const p95 = percentile(connectTimes, 95);
  const p99 = percentile(connectTimes, 99);

  const httpP50 = percentile(httpResult.latencies, 50);
  const httpP95 = percentile(httpResult.latencies, 95);
  const httpP99 = percentile(httpResult.latencies, 99);

  console.log('═══════════════ RESULTS ═══════════════');
  console.log();
  console.log('WebSocket / Collab:');
  console.log(`  Connected:       ${connected}/${USER_COUNT}`);
  console.log(`  Total chars:     ${totalChars.toLocaleString()}`);
  console.log(`  Total updates:   ${totalUpdates.toLocaleString()}`);
  console.log(`  Chars/sec:       ${Math.round(totalChars / totalDuration).toLocaleString()}`);
  console.log(`  Connect p50:     ${p50}ms`);
  console.log(`  Connect p95:     ${p95}ms`);
  console.log(`  Connect p99:     ${p99}ms`);
  if (allErrors.length > 0) {
    console.log(`  Errors:          ${allErrors.length}`);
    const unique = [...new Set(allErrors)];
    for (const e of unique.slice(0, 5)) console.log(`    - ${e}`);
  }
  console.log();
  console.log('HTTP API:');
  console.log(`  Requests:        ${httpResult.requests.toLocaleString()}`);
  console.log(`  Failures:        ${httpResult.failures}`);
  console.log(`  RPS:             ${Math.round(httpResult.requests / totalDuration)}`);
  console.log(`  Latency p50:     ${httpP50}ms`);
  console.log(`  Latency p95:     ${httpP95}ms`);
  console.log(`  Latency p99:     ${httpP99}ms`);
  console.log();
  console.log(`Duration:          ${totalDuration.toFixed(1)}s`);
  console.log('═══════════════════════════════════════');

  // Exit with error if significant failures
  const failRate = (USER_COUNT - connected) / USER_COUNT;
  if (failRate > 0.1) {
    console.error(`\nFAIL: ${((1 - failRate) * 100).toFixed(0)}% connection rate (need >90%)`);
    process.exit(1);
  }
  if (httpResult.failures / httpResult.requests > 0.05) {
    console.error(`\nFAIL: ${((httpResult.failures / httpResult.requests) * 100).toFixed(1)}% HTTP error rate (need <5%)`);
    process.exit(1);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const s = [...sorted].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * s.length) - 1;
  return s[Math.max(0, idx)];
}

main().catch((err) => {
  console.error('Stress test crashed:', err);
  process.exit(1);
});
