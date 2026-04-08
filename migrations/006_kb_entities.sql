-- KB Entity Directory
CREATE TABLE IF NOT EXISTS kb_entities (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  subtype VARCHAR(50) NOT NULL CHECK (subtype IN ('person', 'organization', 'project', 'term')),
  name VARCHAR(200) NOT NULL CHECK (char_length(name) >= 1),
  content JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_entities_workspace ON kb_entities (workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_entities_subtype ON kb_entities (workspace_id, subtype);
CREATE INDEX IF NOT EXISTS idx_kb_entities_name ON kb_entities (workspace_id, name);
-- ILIKE queries on name are covered by the btree index above.
-- For full-text search, consider adding pg_trgm or tsvector in a future migration.
