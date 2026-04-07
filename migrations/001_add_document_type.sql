-- Add document_type column to documents table for multi-app suite support.
-- Defaults to 'text' so existing documents are classified correctly.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'text';

-- Index for filtering by type in the document list
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents (document_type);
