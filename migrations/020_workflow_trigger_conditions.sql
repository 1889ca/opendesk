-- Migration 020: Add trigger_conditions column to workflow_definitions
--
-- Adds a nullable JSONB column that stores pre-trigger condition trees.
-- When NULL, the workflow fires unconditionally on its trigger type (backward-compatible).
-- When set, the condition tree is evaluated against fetched entity state before firing.
--
-- Also adds new trigger_type enum values for document version, KB entity, and form triggers.

ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS trigger_conditions JSONB DEFAULT NULL;

-- Index for efficient lookup of condition-based triggers (cross-document queries).
-- Partial index: only rows with non-null trigger_conditions that are active.
CREATE INDEX IF NOT EXISTS idx_wf_trigger_conditions_active
  ON workflow_definitions (trigger_type)
  WHERE active = true AND trigger_conditions IS NOT NULL;
