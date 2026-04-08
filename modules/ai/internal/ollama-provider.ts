/** Contract: contracts/ai/rules.md */
import type { ModelProvider } from '../contract.ts';

/** Configuration for the Ollama BYOM provider. */
export interface OllamaConfig {
  baseUrl: string;           // e.g. 'http://localhost:11434'
  embeddingModel: string;    // e.g. 'nomic-embed-text'
  generationModel: string;   // e.g. 'llama3'
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  embeddingModel: 'nomic-embed-text',
  generationModel: 'llama3',
};

/** Create a ModelProvider backed by a local Ollama instance. */
export function createOllamaProvider(
  config: Partial<OllamaConfig> = {},
): ModelProvider {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return {
    async embed(text: string): Promise<number[]> {
      const response = await fetch(`${cfg.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cfg.embeddingModel,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama embed failed (${response.status}): ${await response.text()}`,
        );
      }

      const data = (await response.json()) as { embedding: number[] };
      return data.embedding;
    },

    async generate(prompt: string, context?: string): Promise<string> {
      const fullPrompt = context
        ? `Context:\n${context}\n\nQuestion: ${prompt}`
        : prompt;

      const response = await fetch(`${cfg.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cfg.generationModel,
          prompt: fullPrompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama generate failed (${response.status}): ${await response.text()}`,
        );
      }

      const data = (await response.json()) as { response: string };
      return data.response;
    },
  };
}
