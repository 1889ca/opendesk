/** Contract: contracts/storage/rules.md */
import { pool } from './pool.ts';
import { APPLY_SEARCH_SCHEMA } from './pg-search.ts';

const CREATE_DOCUMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    yjs_state BYTEA,
    folder_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const CREATE_FOLDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const ADD_FOLDER_FK = `
  ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL
`;

const CREATE_TEMPLATES_TABLE = `
  CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    content JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const CREATE_VERSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version_number INTEGER NOT NULL,
    UNIQUE (document_id, version_number)
  )
`;

/**
 * Initialize all database tables in dependency order.
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export async function initSchema(): Promise<void> {
  await pool.query(CREATE_DOCUMENTS_TABLE);
  await pool.query(CREATE_FOLDERS_TABLE);
  await pool.query(ADD_FOLDER_FK);
  await pool.query(CREATE_TEMPLATES_TABLE);
  await pool.query(CREATE_VERSIONS_TABLE);
  await pool.query(APPLY_SEARCH_SCHEMA);
}
