-- KB datasets: structured tabular data for knowledge base
CREATE TABLE IF NOT EXISTS kb_datasets (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (name <> ''),
  columns JSONB NOT NULL DEFAULT '[]',
  rows JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sheet-to-dataset linking (one sheet -> at most one dataset)
CREATE TABLE IF NOT EXISTS kb_sheet_links (
  document_id TEXT PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES kb_datasets(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_sheet_links_dataset
  ON kb_sheet_links(dataset_id);
