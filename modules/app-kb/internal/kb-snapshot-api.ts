/** Contract: contracts/app-kb/rules.md */

import { apiFetch } from '@opendesk/app';

const SNAPSHOTS_BASE = '/api/kb/snapshots';

/** Snapshot record as returned from the API. */
export interface KBSnapshotRecord {
  id: string;
  workspaceId: string;
  purpose: string;
  capturedBy: string;
  capturedAt: string;
  entryVersions: Record<string, number>;
}

/** A resolved snapshot entry with versioned data. */
export interface SnapshotEntryRecord {
  entryId: string;
  version: number;
  title: string;
  metadata: Record<string, unknown>;
  tags: string[];
}

/** Build a URL with query parameters. */
function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const str = qs.toString();
  return str ? `${base}?${str}` : base;
}

/** Create a new snapshot of all current entry versions. */
export async function createSnapshotApi(purpose: string): Promise<KBSnapshotRecord> {
  const res = await apiFetch(SNAPSHOTS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `API returned ${res.status}`);
  }
  return res.json();
}

/** List all snapshots, newest first. */
export async function fetchSnapshots(
  opts?: { limit?: number; offset?: number },
): Promise<KBSnapshotRecord[]> {
  const url = buildUrl(SNAPSHOTS_BASE, opts as Record<string, string | number | undefined> ?? {});
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

/** Resolve a snapshot's entries to their versioned data. */
export async function fetchSnapshotEntries(snapshotId: string): Promise<SnapshotEntryRecord[]> {
  const res = await apiFetch(`${SNAPSHOTS_BASE}/${encodeURIComponent(snapshotId)}/entries`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}
