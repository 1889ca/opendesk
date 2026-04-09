/** Contract: contracts/ai/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModelConfig, setActiveModel, addCustomModel, listCustomModels, removeCustomModel } from './config-store.ts';

// Minimal mock pool that tracks queries
function createMockPool() {
  const queries: { text: string; values: unknown[] }[] = [];
  return {
    queries,
    query: vi.fn(async (text: string, values?: unknown[]) => {
      queries.push({ text, values: values ?? [] });

      // SELECT for getModelConfig
      if (text.includes('SELECT') && text.includes('ai_model_config')) {
        return { rows: [], rowCount: 0 };
      }
      // SELECT for listCustomModels
      if (text.includes('SELECT') && text.includes('ai_custom_models')) {
        return { rows: [], rowCount: 0 };
      }
      // INSERT/UPDATE
      if (text.includes('INSERT') || text.includes('UPDATE')) {
        return { rows: [], rowCount: 1 };
      }
      // DELETE
      if (text.includes('DELETE')) {
        return { rows: [], rowCount: 1 };
      }
      // CREATE TABLE
      return { rows: [], rowCount: 0 };
    }),
  };
}

describe('config-store', () => {
  let pool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    pool = createMockPool();
  });

  it('getModelConfig returns defaults when no row exists', async () => {
    const config = await getModelConfig(pool as never);
    expect(config.workspaceId).toBe('default');
    expect(config.embeddingModel).toBeNull();
    expect(config.generationModel).toBeNull();
  });

  it('setActiveModel issues upsert query', async () => {
    await setActiveModel(pool as never, 'default', 'embedding', 'nomic-embed-text');
    const upsert = pool.queries.find((q) => q.text.includes('INSERT'));
    expect(upsert).toBeDefined();
    expect(upsert!.values).toContain('nomic-embed-text');
  });

  it('addCustomModel issues insert query', async () => {
    await addCustomModel(pool as never, {
      id: 'test-model',
      name: 'Test Model',
      ollamaTag: 'test:latest',
      capability: 'generate',
    });
    const insert = pool.queries.find((q) => q.text.includes('ai_custom_models'));
    expect(insert).toBeDefined();
  });

  it('listCustomModels queries ai_custom_models', async () => {
    const result = await listCustomModels(pool as never);
    expect(result).toEqual([]);
  });

  it('removeCustomModel returns true on deletion', async () => {
    const removed = await removeCustomModel(pool as never, 'test-model');
    expect(removed).toBe(true);
  });
});
