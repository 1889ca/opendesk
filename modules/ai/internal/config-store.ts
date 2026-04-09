/** Contract: contracts/ai/rules.md */
import type pg from 'pg';
import type { ModelConfig, CustomModel } from '../contract.ts';

const DEFAULT_WORKSPACE = 'default';

/** Ensure the ai_model_config and ai_custom_models tables exist. */
export async function ensureAiSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_model_config (
      workspace_id TEXT PRIMARY KEY DEFAULT 'default',
      embedding_model TEXT,
      generation_model TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_custom_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ollama_tag TEXT NOT NULL,
      capability TEXT NOT NULL CHECK (capability IN ('embed', 'generate', 'both')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/** Get the active model config for a workspace. Returns defaults if not set. */
export async function getModelConfig(
  pool: pg.Pool,
  workspaceId = DEFAULT_WORKSPACE,
): Promise<ModelConfig> {
  const result = await pool.query<{
    workspace_id: string;
    embedding_model: string | null;
    generation_model: string | null;
    updated_at: Date;
  }>(
    'SELECT * FROM ai_model_config WHERE workspace_id = $1',
    [workspaceId],
  );

  if (result.rows.length === 0) {
    return {
      workspaceId,
      embeddingModel: null,
      generationModel: null,
      updatedAt: new Date(),
    };
  }

  const row = result.rows[0];
  return {
    workspaceId: row.workspace_id,
    embeddingModel: row.embedding_model,
    generationModel: row.generation_model,
    updatedAt: row.updated_at,
  };
}

/** Set the active embedding or generation model for a workspace. */
export async function setActiveModel(
  pool: pg.Pool,
  workspaceId: string,
  role: 'embedding' | 'generation',
  modelId: string,
): Promise<ModelConfig> {
  const column = role === 'embedding' ? 'embedding_model' : 'generation_model';
  await pool.query(
    `INSERT INTO ai_model_config (workspace_id, ${column}, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (workspace_id)
     DO UPDATE SET ${column} = $2, updated_at = NOW()`,
    [workspaceId, modelId],
  );
  return getModelConfig(pool, workspaceId);
}

/** List all custom models. */
export async function listCustomModels(pool: pg.Pool): Promise<CustomModel[]> {
  const result = await pool.query<{
    id: string;
    name: string;
    ollama_tag: string;
    capability: string;
  }>('SELECT id, name, ollama_tag, capability FROM ai_custom_models ORDER BY name');
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    ollamaTag: r.ollama_tag,
    capability: r.capability as CustomModel['capability'],
  }));
}

/** Add a custom model. */
export async function addCustomModel(
  pool: pg.Pool,
  model: CustomModel,
): Promise<void> {
  await pool.query(
    `INSERT INTO ai_custom_models (id, name, ollama_tag, capability)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET name = $2, ollama_tag = $3, capability = $4`,
    [model.id, model.name, model.ollamaTag, model.capability],
  );
}

/** Remove a custom model. */
export async function removeCustomModel(
  pool: pg.Pool,
  id: string,
): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM ai_custom_models WHERE id = $1',
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
