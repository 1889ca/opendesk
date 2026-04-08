-- KB entries table for knowledge base
CREATE TABLE IF NOT EXISTS kb_entries (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('reference', 'entity', 'dataset', 'note', 'glossary')),
  corpus TEXT NOT NULL CHECK (corpus IN ('knowledge', 'operational', 'reference')),
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'published', 'archived')),
  title TEXT NOT NULL CHECK (length(title) > 0),
  tags JSONB NOT NULL DEFAULT '[]',
  content JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_entries_workspace ON kb_entries (workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_entries_type ON kb_entries (workspace_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_kb_entries_corpus ON kb_entries (workspace_id, corpus);
CREATE INDEX IF NOT EXISTS idx_kb_entries_lifecycle ON kb_entries (workspace_id, lifecycle);
