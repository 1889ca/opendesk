/** Contract: contracts/kb/rules.md */
import type { KBEntry } from './types.ts';
import { type ReferenceMetadata, ReferenceMetadataSchema } from './schemas.ts';

/**
 * Legacy Reference type as it existed in the references module.
 * Used for migration mapping.
 */
export interface LegacyReference {
  id: string;
  workspaceId: string;
  doi?: string;
  title: string;
  authors: string[];
  journal?: string;
  year?: number;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
  url?: string;
  publisher?: string;
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Convert a legacy Reference to a KBEntry of type "reference". */
export function referenceToEntry(ref: LegacyReference): KBEntry {
  const metadata: ReferenceMetadata = {
    doi: ref.doi,
    authors: ref.authors,
    journal: ref.journal,
    year: ref.year,
    volume: ref.volume,
    issue: ref.issue,
    pages: ref.pages,
    abstract: ref.abstract,
    url: ref.url,
    publisher: ref.publisher,
  };

  return {
    id: ref.id,
    workspaceId: ref.workspaceId,
    entryType: 'reference',
    title: ref.title,
    metadata: ReferenceMetadataSchema.parse(metadata),
    tags: ref.tags,
    version: 1,
    corpus: 'reference',
    jurisdiction: null,
    createdBy: ref.createdBy,
    createdAt: ref.createdAt,
    updatedAt: ref.updatedAt,
  };
}

/** Convert a KBEntry of type "reference" back to the legacy Reference shape. */
export function entryToReference(entry: KBEntry): LegacyReference {
  if (entry.entryType !== 'reference') {
    throw new Error(`Cannot convert entry of type "${entry.entryType}" to Reference`);
  }

  const meta = ReferenceMetadataSchema.parse(entry.metadata);

  return {
    id: entry.id,
    workspaceId: entry.workspaceId,
    doi: meta.doi,
    title: entry.title,
    authors: meta.authors,
    journal: meta.journal,
    year: meta.year,
    volume: meta.volume,
    issue: meta.issue,
    pages: meta.pages,
    abstract: meta.abstract,
    url: meta.url,
    publisher: meta.publisher,
    tags: entry.tags,
    createdBy: entry.createdBy,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
