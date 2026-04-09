/** Contract: contracts/ai/rules.md */
import { createLogger } from '../../logger/index.ts';
import type { OllamaModelInfo, PullProgress } from '../contract.ts';

const log = createLogger('ai:ollama');

export type OllamaClientOpts = {
  baseUrl: string;
};

/** Thin HTTP client over Ollama's REST API for model management. */
export function createOllamaClient(opts: OllamaClientOpts) {
  const { baseUrl } = opts;

  /** List all locally installed models via GET /api/tags. */
  async function listInstalled(): Promise<OllamaModelInfo[]> {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Ollama /api/tags failed: ${res.status}`);
    const data = (await res.json()) as { models: Array<Record<string, unknown>> };
    return (data.models ?? []).map((m) => ({
      name: String(m.name ?? ''),
      size: Number(m.size ?? 0),
      digest: String(m.digest ?? ''),
      modifiedAt: String(m.modified_at ?? ''),
    }));
  }

  /** Pull a model. Returns async iterable of progress events. */
  async function* pull(tag: string): AsyncGenerator<PullProgress> {
    log.info('pulling model', { tag });
    const res = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tag, stream: true }),
    });
    if (!res.ok) throw new Error(`Ollama /api/pull failed: ${res.status}`);
    if (!res.body) throw new Error('No response body from Ollama pull');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line) as Record<string, unknown>;
        yield {
          status: String(parsed.status ?? ''),
          digest: parsed.digest ? String(parsed.digest) : undefined,
          total: parsed.total ? Number(parsed.total) : undefined,
          completed: parsed.completed ? Number(parsed.completed) : undefined,
        };
      }
    }
  }

  /** Delete a model via DELETE /api/delete. */
  async function remove(tag: string): Promise<void> {
    log.info('removing model', { tag });
    const res = await fetch(`${baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tag }),
    });
    if (!res.ok) throw new Error(`Ollama /api/delete failed: ${res.status}`);
  }

  return { listInstalled, pull, remove };
}

export type OllamaClient = ReturnType<typeof createOllamaClient>;
