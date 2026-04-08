# Contract: kb

## Purpose

Knowledge Base dataset storage for structured tabular data.
Datasets are collections of rows with named columns, stored in PostgreSQL.
Sheets can link to datasets for two-way synchronization.

## Inputs

- `listDatasets()`: List all datasets.
- `getDataset(id)`: Get a dataset by ID with all rows.
- `createDataset(name, columns, rows)`: Create a new dataset.
- `updateDatasetRows(id, rows)`: Replace all rows in a dataset.
- `deleteDataset(id)`: Delete a dataset.
- `linkSheet(datasetId, documentId)`: Link a sheet to a dataset.
- `unlinkSheet(documentId)`: Remove dataset link from a sheet.
- `getLinkedDataset(documentId)`: Get the dataset linked to a sheet.

## Outputs

- `Dataset`: `{ id, name, columns, rows, createdAt, updatedAt }`
- `DatasetRow`: `{ cells: string[] }` — cell values matching column order
- `SheetLink`: `{ datasetId, documentId, linkedAt }`

## Invariants

1. Dataset names are non-empty strings.
2. Every row's cell count matches the dataset's column count.
3. A sheet can link to at most one dataset at a time.
4. Deleting a dataset removes all sheet links to it.

## Dependencies

- `storage` — PostgreSQL pool for persistence.

## File Structure

```
modules/kb/
  contract.ts    -- Zod schemas and types
  index.ts       -- re-exports public API
  internal/
    pg-datasets.ts -- PostgreSQL dataset store
```
