/** Contract: contracts/ai/rules.md */
import type pg from 'pg';
import type { ModelZooEntry, CustomModel, ModelConfig, PullProgress } from '../contract.ts';
import { loadZoo, findZooEntry } from './zoo-loader.ts';
import type { OllamaClient } from './ollama-client.ts';
import { getModelConfig, setActiveModel, listCustomModels, addCustomModel, removeCustomModel } from './config-store.ts';

export type ModelListItem = {
  id: string;
  name: string;
  ollamaTag: string;
  sizeGb?: number;
  capability: string;
  license?: string;
  tier?: string;
  useCases?: string[];
  hardware?: { ramGb: number; vramGb: number };
  description?: string;
  installed: boolean;
  isCustom: boolean;
};

export type ModelServiceDeps = {
  pool: pg.Pool;
  ollama: OllamaClient;
};

/** Core model management: merges zoo + custom models with Ollama install status. */
export function createModelService(deps: ModelServiceDeps) {
  const { pool, ollama } = deps;

  /** List all models (zoo + custom) with installed status from Ollama. */
  async function listModels(): Promise<ModelListItem[]> {
    const [zoo, customs, installed] = await Promise.all([
      Promise.resolve(loadZoo()),
      listCustomModels(pool),
      ollama.listInstalled(),
    ]);

    const installedTags = new Set(installed.map((m) => m.name));

    const zooItems: ModelListItem[] = zoo.map((z) => ({
      id: z.id,
      name: z.name,
      ollamaTag: z.ollamaTag,
      sizeGb: z.sizeGb,
      capability: z.capability,
      license: z.license,
      tier: z.tier,
      useCases: z.useCases,
      hardware: z.hardware,
      description: z.description,
      installed: installedTags.has(z.ollamaTag),
      isCustom: false,
    }));

    const customItems: ModelListItem[] = customs.map((c) => ({
      id: c.id,
      name: c.name,
      ollamaTag: c.ollamaTag,
      capability: c.capability,
      installed: installedTags.has(c.ollamaTag),
      isCustom: true,
    }));

    return [...zooItems, ...customItems];
  }

  /** Pull a model by ID. Resolves the Ollama tag from zoo or custom list. */
  async function pullModel(id: string): Promise<AsyncGenerator<PullProgress>> {
    const tag = await resolveTag(id);
    if (!tag) throw new Error(`Unknown model: ${id}`);
    return ollama.pull(tag);
  }

  /** Remove a model from Ollama by ID. */
  async function deleteModel(id: string): Promise<void> {
    const tag = await resolveTag(id);
    if (!tag) throw new Error(`Unknown model: ${id}`);
    await ollama.remove(tag);
  }

  /** Get the active model config for a workspace. */
  async function getConfig(workspaceId = 'default'): Promise<ModelConfig> {
    return getModelConfig(pool, workspaceId);
  }

  /** Set a model as active for embedding or generation. */
  async function setActive(
    workspaceId: string,
    role: 'embedding' | 'generation',
    modelId: string,
  ): Promise<ModelConfig> {
    return setActiveModel(pool, workspaceId, role, modelId);
  }

  /** Register a custom model. */
  async function registerCustom(model: CustomModel): Promise<void> {
    await addCustomModel(pool, model);
  }

  /** Unregister a custom model. */
  async function unregisterCustom(id: string): Promise<boolean> {
    return removeCustomModel(pool, id);
  }

  /** Resolve model ID to Ollama tag. Checks zoo first, then custom. */
  async function resolveTag(id: string): Promise<string | null> {
    const zooEntry = findZooEntry(id);
    if (zooEntry) return zooEntry.ollamaTag;
    const customs = await listCustomModels(pool);
    const custom = customs.find((c) => c.id === id);
    return custom?.ollamaTag ?? null;
  }

  return { listModels, pullModel, deleteModel, getConfig, setActive, registerCustom, unregisterCustom };
}

export type ModelService = ReturnType<typeof createModelService>;
