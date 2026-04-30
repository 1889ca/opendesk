-- Migration 019: Cold storage tier support
-- Adds tier tracking, archival timestamp, and S3 object key to documents.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'hot' CHECK (tier IN ('hot', 'cold'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cold_key TEXT;
