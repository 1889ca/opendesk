/** Contract: contracts/ai/rules.md */
import { createLogger } from '../../logger/index.ts';

const log = createLogger('ai:ollama');

export interface OllamaClient {
  /** Generate embeddings for a text string. Returns a float array. */
  embed(text: string): Promise<number[]>;
  /** Generate a chat completion given a system prompt and user message. */
  chat(system: string, user: string): Promise<string>;
  /** Check if Ollama is reachable. */
  ping(): Promise<boolean>;
}

export interface OllamaConfig {
  baseUrl: string;
  embeddingModel: string;
  chatModel: string;
}

/**
 * BYOM abstraction layer over Ollama HTTP API.
 * All inference goes through this client — no direct HTTP calls elsewhere.
 */
export function createOllamaClient(config: OllamaConfig): OllamaClient {
  const { baseUrl, embeddingModel, chatModel } = config;

  async function embed(text: string): Promise<number[]> {
    const res = await fetch(`${baseUrl}/api/embed`, {
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
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: chatModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
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
      const res = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  return { embed, chat, ping };
}
