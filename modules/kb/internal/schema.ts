/** Contract: contracts/kb/rules.md */
import { pool } from '../../storage/internal/pool.ts';

export const CREATE_KB_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS kb_entries (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL,
    entry_type TEXT NOT NULL,
    title TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

export const CREATE_KB_ENTRIES_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_kb_entries_workspace
    ON kb_entries (workspace_id);
  CREATE INDEX IF NOT EXISTS idx_kb_entries_type
    ON kb_entries (workspace_id, entry_type);
  CREATE INDEX IF NOT EXISTS idx_kb_entries_tags
    ON kb_entries USING GIN (tags);
`;

export const CREATE_KB_RELATIONSHIPS_TABLE = `
  CREATE TABLE IF NOT EXISTS kb_relationships (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL,
    source_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, source_id, target_id, relation_type)
  )
`;

export const CREATE_KB_RELATIONSHIPS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_kb_rel_source
    ON kb_relationships (source_id);
  CREATE INDEX IF NOT EXISTS idx_kb_rel_target
    ON kb_relationships (target_id);
  CREATE INDEX IF NOT EXISTS idx_kb_rel_workspace
    ON kb_relationships (workspace_id);
`;

export const CREATE_KB_VERSION_HISTORY_TABLE = `
  CREATE TABLE IF NOT EXISTS kb_version_history (
    id UUID PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entry_id, version)
  )
`;

export const CREATE_KB_DATASET_ROWS_TABLE = `
  CREATE TABLE IF NOT EXISTS kb_dataset_rows (
    id UUID PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

export const CREATE_KB_DATASET_ROWS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_kb_dataset_rows_entry
    ON kb_dataset_rows (entry_id);
  CREATE INDEX IF NOT EXISTS idx_kb_dataset_rows_order
    ON kb_dataset_rows (entry_id, row_index);
`;

export const APPLY_KB_SEARCH_SCHEMA = `
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'kb_entries' AND column_name = 'search_vector'
    ) THEN
      ALTER TABLE kb_entries ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
          to_tsvector('english', coalesce(title, '') || ' ' || coalesce(metadata::text, ''))
        ) STORED;
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_kb_entries_search
    ON kb_entries USING GIN (search_vector);
`;

/** Initialize KB database tables. Safe to call multiple times. */
export async function initKBSchema(): Promise<void> {
  await pool.query(CREATE_KB_ENTRIES_TABLE);
  await pool.query(CREATE_KB_ENTRIES_INDEXES);
  await pool.query(CREATE_KB_RELATIONSHIPS_TABLE);
  await pool.query(CREATE_KB_RELATIONSHIPS_INDEXES);
  await pool.query(CREATE_KB_VERSION_HISTORY_TABLE);
  await pool.query(CREATE_KB_DATASET_ROWS_TABLE);
  await pool.query(CREATE_KB_DATASET_ROWS_INDEXES);
  await pool.query(APPLY_KB_SEARCH_SCHEMA);
}
