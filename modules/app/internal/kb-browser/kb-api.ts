/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';

/** KB entry as returned from the API. */
export interface KBEntryRecord {
  id: string;
  workspaceId: string;
  entryType: string;
  title: string;
  metadata: Record<string, unknown>;
  tags: string[];
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Present when returned from search. */
  snippet?: string;
  rank?: number;
}

/** KB relationship as returned from the API. */
export interface KBRelationshipRecord {
  id: string;
  workspaceId: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface KBListParams {
  entryType?: string;
  tags?: string;
  search?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

const BASE = '/api/kb/entries';

/** Build a URL with query parameters. */
function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const str = qs.toString();
  return str ? `${base}?${str}` : base;
}

/** List/search KB entries with optional filters. */
export async function fetchEntries(params: KBListParams = {}): Promise<KBEntryRecord[]> {
  const url = buildUrl(BASE, params as Record<string, string | number | undefined>);
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

/** Get a single KB entry by ID. */
export async function fetchEntry(id: string): Promise<KBEntryRecord> {
  const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

/** Create a new KB entry. */
export async function createEntryApi(payload: {
  entryType: string;
  title: string;
  metadata: Record<string, unknown>;
  tags: string[];
}): Promise<KBEntryRecord> {
  const res = await apiFetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `API returned ${res.status}`);
  }
  return res.json();
}

/** Update an existing KB entry. */
export async function updateEntryApi(
  id: string,
  payload: { title?: string; metadata?: Record<string, unknown>; tags?: string[] },
): Promise<KBEntryRecord> {
  const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

/** Delete a KB entry by ID. */
export async function deleteEntryApi(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
}

// --- Dataset row operations ---

export interface DatasetRowRecord {
  id: string;
  entry_id: string;
  row_index: number;
  data: Record<string, unknown>;
  created_at: string;
}

export interface DatasetRowsResponse {
  rows: DatasetRowRecord[];
  total: number;
}

/** Fetch rows for a dataset entry. */
export async function fetchDatasetRows(
  entryId: string,
  opts?: { limit?: number; offset?: number },
): Promise<DatasetRowsResponse> {
  const url = buildUrl(`${BASE}/${encodeURIComponent(entryId)}/rows`, opts as Record<string, string | number | undefined> ?? {});
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

/** Replace all rows in a dataset entry. */
export async function replaceDatasetRows(
  entryId: string,
  rows: { data: Record<string, unknown> }[],
): Promise<DatasetRowsResponse> {
  const res = await apiFetch(`${BASE}/${encodeURIComponent(entryId)}/rows`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

/** Get relationships for an entry. */
export async function fetchRelationships(
  entryId: string,
  direction: 'outgoing' | 'incoming' | 'both' = 'both',
): Promise<KBRelationshipRecord[]> {
  const url = buildUrl(`${BASE}/${encodeURIComponent(entryId)}/relationships`, { direction });
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}
