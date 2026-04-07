/** Contract: contracts/storage/rules.md */
import { pool } from './pool.ts';
import { APPLY_SEARCH_SCHEMA } from './pg-search.ts';
import { CREATE_TEMPLATES_TABLE } from './templates.ts';

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

const CREATE_GRANTS_TABLE = `
  CREATE TABLE IF NOT EXISTS grants (
    id UUID PRIMARY KEY,
    principal_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'document',
    role TEXT NOT NULL,
    granted_by TEXT NOT NULL DEFAULT '',
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
  )
`;

const CREATE_GRANTS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_grants_principal_resource
    ON grants (principal_id, resource_id, resource_type)
`;

const CREATE_SHARE_LINKS_TABLE = `
  CREATE TABLE IF NOT EXISTS share_links (
    token TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    grantor_id TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    max_redemptions INTEGER,
    redemption_count INTEGER NOT NULL DEFAULT 0,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const ADD_DOCUMENT_TYPE_CHECK = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_document_type'
    ) THEN
      ALTER TABLE documents
        ADD CONSTRAINT chk_document_type
        CHECK (document_type IN ('text', 'spreadsheet', 'presentation'));
    END IF;
  END $$
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
  await pool.query(CREATE_GRANTS_TABLE);
  await pool.query(CREATE_GRANTS_INDEX);
  await pool.query(CREATE_SHARE_LINKS_TABLE);
  await pool.query(APPLY_SEARCH_SCHEMA);
  await pool.query(ADD_DOCUMENT_TYPE_CHECK);
}
