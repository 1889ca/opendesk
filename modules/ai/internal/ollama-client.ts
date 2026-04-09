/** Contract: contracts/ai/rules.md */
import { createLogger } from '../../logger/index.ts';
import { httpFetch } from '../../http/index.ts';
import type { OllamaModelInfo, PullProgress } from '../contract.ts';

const log = createLogger('ai:ollama');

export interface OllamaConfig {
  baseUrl: string;
  embeddingModel?: string;
  chatModel?: string;
}

export interface OllamaClient {
  /** Generate embeddings for a text string. Requires embeddingModel config. */
  embed(text: string): Promise<number[]>;
  /** Generate a chat completion. Requires chatModel config. */
  chat(system: string, user: string): Promise<string>;
  /** Check if Ollama is reachable. */
  ping(): Promise<boolean>;
  /** List all locally installed models. */
  listInstalled(): Promise<OllamaModelInfo[]>;
  /** Pull a model. Returns async iterable of progress events. */
  pull(tag: string): AsyncGenerator<PullProgress>;
  /** Delete a model. */
  remove(tag: string): Promise<void>;
}

/** BYOM abstraction layer over Ollama HTTP API. */
export function createOllamaClient(config: OllamaConfig): OllamaClient {
  const { baseUrl, embeddingModel, chatModel } = config;

  async function embed(text: string): Promise<number[]> {
    if (!embeddingModel) throw new Error('embeddingModel not configured');
    const res = await httpFetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: embeddingModel, input: text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama embed failed (${res.status}): ${body}`);
    }
    const data = await res.json() as { embeddings: number[][] };
    return data.embeddings[0];
  }

  async function chat(system: string, user: string): Promise<string> {
    if (!chatModel) throw new Error('chatModel not configured');
    const res = await httpFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        stream: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama chat failed (${res.status}): ${body}`);
    }
    const data = await res.json() as { message: { content: string } };
    return data.message.content;
  }

  async function ping(): Promise<boolean> {
    try {
      const res = await httpFetch(`${baseUrl}/api/tags`, { method: 'GET', timeoutMs: 5_000 });
      return res.ok;
    } catch {
      return false;
    }
  }

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

  async function remove(tag: string): Promise<void> {
    log.info('removing model', { tag });
    const res = await fetch(`${baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tag }),
    });
    if (!res.ok) throw new Error(`Ollama /api/delete failed: ${res.status}`);
  }

  return { embed, chat, ping, listInstalled, pull, remove };
}
