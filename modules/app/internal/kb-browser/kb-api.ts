/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';
import type { KbEntryStatus } from '../../../kb/contract.ts';

export interface KbEntryData {
  id: string;
  workspace_id: string;
  title: string;
  body: string;
  status: KbEntryStatus;
  version: number;
  tags: string[];
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KbVersionData {
  id: string;
  entry_id: string;
  version: number;
  title: string;
  body: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export async function fetchEntries(status?: KbEntryStatus): Promise<KbEntryData[]> {
  const params = status ? `?status=${status}` : '';
  const res = await apiFetch(`/api/kb${params}`);
  if (!res.ok) throw new Error(`Failed to fetch KB entries: ${res.status}`);
  return res.json();
}

export async function fetchEntry(id: string): Promise<KbEntryData> {
  const res = await apiFetch(`/api/kb/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch KB entry: ${res.status}`);
  return res.json();
}

export async function createEntry(title: string, body: string): Promise<KbEntryData> {
  const res = await apiFetch('/api/kb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) throw new Error(`Failed to create KB entry: ${res.status}`);
  return res.json();
}

export async function updateEntry(
  id: string,
  updates: { title?: string; body?: string; tags?: string[] },
): Promise<KbEntryData> {
  const res = await apiFetch(`/api/kb/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update KB entry: ${res.status}`);
  return res.json();
}

export async function transitionEntry(
  id: string,
  to: KbEntryStatus,
): Promise<{ ok: boolean; entry: KbEntryData; previousStatus: KbEntryStatus }> {
  const res = await apiFetch(`/api/kb/${encodeURIComponent(id)}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Transition failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteEntry(id: string): Promise<void> {
  const res = await apiFetch(`/api/kb/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete KB entry: ${res.status}`);
}

export async function fetchVersions(entryId: string): Promise<KbVersionData[]> {
  const res = await apiFetch(`/api/kb/${encodeURIComponent(entryId)}/versions`);
  if (!res.ok) throw new Error(`Failed to fetch versions: ${res.status}`);
  return res.json();
}

export async function resolveReference(
  entryId: string,
  version: number | 'latest',
): Promise<{ entryId: string; version: number; title: string; body: string; status: string }> {
  const res = await apiFetch('/api/kb/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryId, version }),
  });
  if (!res.ok) throw new Error(`Failed to resolve reference: ${res.status}`);
  return res.json();
}
