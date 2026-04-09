/** Contract: contracts/app/rules.md */
import { apiFetch } from '../shared/api-client.ts';

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

export type ModelConfig = {
  workspaceId: string;
  embeddingModel: string | null;
  generationModel: string | null;
  updatedAt: string;
};

export type ModelsResponse = {
  models: ModelListItem[];
  config: ModelConfig;
};

/** Fetch all models and active config. */
export async function fetchModels(): Promise<ModelsResponse> {
  const res = await apiFetch('/api/ai/models');
  if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
  return res.json();
}

/** Set active model for embedding or generation role. */
export async function setActiveModel(
  role: 'embedding' | 'generation',
  modelId: string,
): Promise<ModelConfig> {
  const res = await apiFetch('/api/ai/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, modelId }),
  });
  if (!res.ok) throw new Error(`Failed to set active model: ${res.status}`);
  return res.json();
}

/** Pull (download) a model. Returns an EventSource-like reader. */
export async function pullModel(
  id: string,
  onProgress: (data: { status: string; total?: number; completed?: number }) => void,
): Promise<void> {
  const res = await apiFetch(`/api/ai/models/${id}/pull`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to pull model: ${res.status}`);
  if (!res.body) return;

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
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (!json) continue;
      onProgress(JSON.parse(json));
    }
  }
}

/** Delete a model from Ollama. */
export async function deleteModel(id: string): Promise<void> {
  const res = await apiFetch(`/api/ai/models/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete model: ${res.status}`);
}

/** Register a custom model. */
export async function addCustomModel(
  name: string,
  ollamaTag: string,
  capability: string,
): Promise<void> {
  const id = ollamaTag.replace(/[^a-z0-9-]/g, '-');
  const res = await apiFetch('/api/ai/models/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, ollamaTag, capability }),
  });
  if (!res.ok) throw new Error(`Failed to add custom model: ${res.status}`);
}

/** Remove a custom model. */
export async function deleteCustomModel(id: string): Promise<void> {
  const res = await apiFetch(`/api/ai/models/custom/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete custom model: ${res.status}`);
}
