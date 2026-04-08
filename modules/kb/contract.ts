/** Contract: contracts/kb/rules.md */

import { z } from 'zod';

export const DatasetRowSchema = z.object({
  cells: z.array(z.string()),
});

export type DatasetRow = z.infer<typeof DatasetRowSchema>;

export const DatasetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  columns: z.array(z.string().min(1)),
  rows: z.array(DatasetRowSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Dataset = z.infer<typeof DatasetSchema>;

export const CreateDatasetSchema = z.object({
  name: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(DatasetRowSchema).default([]),
});

export type CreateDatasetInput = z.infer<typeof CreateDatasetSchema>;

export const UpdateDatasetRowsSchema = z.object({
  rows: z.array(DatasetRowSchema),
});

export type UpdateDatasetRowsInput = z.infer<typeof UpdateDatasetRowsSchema>;

export const SheetLinkSchema = z.object({
  datasetId: z.string().uuid(),
  documentId: z.string().min(1),
  linkedAt: z.string().datetime(),
});

export type SheetLink = z.infer<typeof SheetLinkSchema>;

export interface DatasetStore {
  list(): Promise<Dataset[]>;
  get(id: string): Promise<Dataset | null>;
  create(input: CreateDatasetInput): Promise<Dataset>;
  updateRows(id: string, rows: DatasetRow[]): Promise<Dataset | null>;
  delete(id: string): Promise<boolean>;
  linkSheet(datasetId: string, documentId: string): Promise<SheetLink>;
  unlinkSheet(documentId: string): Promise<boolean>;
  getLinkedDataset(documentId: string): Promise<Dataset | null>;
  getSheetLink(documentId: string): Promise<SheetLink | null>;
}
