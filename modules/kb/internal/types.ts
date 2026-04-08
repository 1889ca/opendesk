/** Contract: contracts/kb/rules.md */

/** Supported KB entry types. */
export const EntryType = {
  Reference: 'reference',
  Entity: 'entity',
  Dataset: 'dataset',
  Note: 'note',
} as const;

export type EntryType = (typeof EntryType)[keyof typeof EntryType];

/** Built-in relationship types. Custom strings are also allowed. */
export const RelationType = {
  Cites: 'cites',
  AuthoredBy: 'authored-by',
  RelatedTo: 'related-to',
  DerivedFrom: 'derived-from',
  Supersedes: 'supersedes',
} as const;

export type RelationType = string;

/** Entity subtypes for the entity entry type. */
export const EntitySubtype = {
  Person: 'person',
  Organization: 'organization',
  Place: 'place',
  Project: 'project',
  Term: 'term',
} as const;

export type EntitySubtype = (typeof EntitySubtype)[keyof typeof EntitySubtype];

/** Corpus partition — controls RAG visibility. */
export type CorpusPartition = 'knowledge' | 'operational' | 'reference';

/** Full KB entry as stored in the database. */
export interface KBEntry {
  id: string;
  workspaceId: string;
  entryType: EntryType;
  title: string;
  metadata: Record<string, unknown>;
  tags: string[];
  version: number;
  corpus: CorpusPartition;
  jurisdiction: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Full KB relationship as stored in the database. */
export interface KBRelationship {
  id: string;
  workspaceId: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/** Filter options for listing/searching entries. */
export interface KBQueryFilter {
  entryType?: EntryType;
  tags?: string[];
  search?: string;
  corpus?: CorpusPartition;
  jurisdiction?: string;
  limit?: number;
  offset?: number;
}

/** Search result with relevance info. */
export interface KBSearchResult {
  entry: KBEntry;
  rank: number;
  snippet: string;
}

/** Version history record. */
export interface KBVersionRecord {
  id: string;
  entryId: string;
  version: number;
  title: string;
  metadata: Record<string, unknown>;
  tags: string[];
  changedBy: string;
  changedAt: Date;
}
