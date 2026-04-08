/**
 * Collab Stress Test — main entry point.
 *
 * Spawns N concurrent WebSocket users + HTTP load, then prints a report.
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

import {
  type UserMetrics,
  USER_COUNT,
  DURATION_S,
  DOC_ID,
  WS_URL,
  TYPING_MS,
  percentile,
} from './config.js';
import { spawnUser } from './collab-users.js';
import { stressHttp } from './http-stress.js';

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
  const metrics: UserMetrics[] = [];

  const userPromises = Array.from({ length: USER_COUNT }, (_, i) => spawnUser(i, metrics));
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
  printReport(userResults, httpResult, startTime);
}

function printReport(userResults: UserMetrics[], httpResult: { requests: number; failures: number; latencies: number[] }, startTime: number) {
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

main().catch((err) => {
  console.error('Stress test crashed:', err);
  process.exit(1);
});
