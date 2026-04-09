-- Wasm plugin registry for sandboxed local service integrations
CREATE TABLE IF NOT EXISTS wasm_plugins (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  wasm_binary BYTEA NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}',
  output_schema JSONB NOT NULL DEFAULT '{}',
  version TEXT NOT NULL DEFAULT '1.0.0',
  built_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wasm_plugins_name ON wasm_plugins (name);
