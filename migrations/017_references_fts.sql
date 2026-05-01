-- Full-text search for reference_entries.
-- Adds a generated tsvector column covering title, authors (as text),
-- and abstract, plus a GIN index for fast tsquery lookups.
--
-- The authors column is JSONB. We cast it to text to include author
-- names in the search vector. This is intentionally coarse — a
-- dedicated JSONB path search would be more precise but is not needed
-- for MVP-level FTS.

ALTER TABLE reference_entries
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(authors::text, '') || ' ' ||
      coalesce(abstract, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_reference_entries_fts
  ON reference_entries USING GIN(search_vector);
