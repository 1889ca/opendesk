-- Add document_type column to documents table for multi-app suite support.
-- Defaults to 'text' so existing documents are classified correctly.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'text';

-- Index for filtering by type in the document list
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents (document_type);

-- Constraint to enforce valid document types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_document_type'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT chk_document_type
      CHECK (document_type IN ('text', 'spreadsheet', 'presentation'));
  END IF;
END $$;
