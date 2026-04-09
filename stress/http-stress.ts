/**
 * Collab Stress Test — HTTP API stress runner.
 * Hammers health and document-list endpoints for the test duration.
 */

import { type HttpMetrics, WS_URL, DURATION_S } from './config.js';

export async function stressHttp(): Promise<HttpMetrics> {
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
