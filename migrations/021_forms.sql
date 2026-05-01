-- Migration 021: Forms module tables
--
-- forms: authored form definitions (schema is JSONB — the FormDefinition blob)
-- form_responses: respondent submissions keyed per form + optional principal

CREATE TABLE IF NOT EXISTS forms (
  id              TEXT        PRIMARY KEY,
  workspace_id    TEXT        NOT NULL,
  owner_id        TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  schema          JSONB       NOT NULL,
  version         INTEGER     NOT NULL DEFAULT 1,
  anonymous       BOOLEAN     NOT NULL DEFAULT FALSE,
  single_response BOOLEAN     NOT NULL DEFAULT FALSE,
  close_at        TIMESTAMPTZ NULL,
  closed          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forms_workspace ON forms (workspace_id);
CREATE INDEX IF NOT EXISTS idx_forms_owner     ON forms (owner_id);

-- form_responses: one row per submission
CREATE TABLE IF NOT EXISTS form_responses (
  id                 TEXT        PRIMARY KEY,
  form_id            TEXT        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  definition_version INTEGER     NOT NULL,
  respondent_id      TEXT        NULL,
  answers            JSONB       NOT NULL,
  tombstoned         BOOLEAN     NOT NULL DEFAULT FALSE,
  ip_address         TEXT        NULL,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_responses_form_id      ON form_responses (form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_respondent   ON form_responses (form_id, respondent_id)
  WHERE respondent_id IS NOT NULL;

-- Partial unique index enforcing single_response per authenticated respondent.
-- Only one non-tombstoned response per (form_id, respondent_id) is allowed;
-- the application layer checks single_response flag and upserts accordingly.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_form_single_response
  ON form_responses (form_id, respondent_id)
  WHERE respondent_id IS NOT NULL AND tombstoned = FALSE;
