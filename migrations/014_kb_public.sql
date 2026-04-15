-- Migration: 014_kb_public
-- Purpose: Add kb_settings table to support public KB toggle (issue #431)
-- NOTE: DO NOT RUN automatically — requires human review per CONSTITUTION.md
--
-- This creates a per-workspace settings table for the Knowledge Base module.
-- The is_public flag controls unauthenticated read access to /api/kb/public.

CREATE TABLE IF NOT EXISTS kb_settings (
  workspace_id UUID PRIMARY KEY,
  is_public    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the default workspace row (non-public by default)
INSERT INTO kb_settings (workspace_id, is_public)
VALUES ('00000000-0000-0000-0000-000000000000', false)
ON CONFLICT (workspace_id) DO NOTHING;
