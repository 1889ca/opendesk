-- AI model configuration: per-workspace active model selection
CREATE TABLE IF NOT EXISTS ai_model_config (
  workspace_id TEXT PRIMARY KEY DEFAULT 'default',
  embedding_model TEXT,
  generation_model TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custom (non-zoo) models added by admins
CREATE TABLE IF NOT EXISTS ai_custom_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ollama_tag TEXT NOT NULL,
  capability TEXT NOT NULL CHECK (capability IN ('embed', 'generate', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
