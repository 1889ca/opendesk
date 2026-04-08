-- Add graph column to workflow_definitions for visual editor node/edge data
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS graph JSONB;

-- Execution step logs for auditable per-node tracking
CREATE TABLE IF NOT EXISTS workflow_execution_steps (
  id UUID PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('trigger', 'condition', 'action', 'parallel_split')),
  input JSONB,
  output JSONB,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('evaluated', 'executed', 'skipped', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exec_steps_execution ON workflow_execution_steps (execution_id, created_at);
