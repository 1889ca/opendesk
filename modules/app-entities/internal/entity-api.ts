/** Contract: contracts/app-entities/rules.md */
import { apiFetch } from '@opendesk/app';

export interface EntityRecord {
  id: string;
  workspace_id: string;
  subtype: string;
  name: string;
  content: Record<string, unknown>;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EntityCreatePayload {
  name: string;
  subtype: string;
  content: Record<string, unknown>;
  tags: string[];
}

export interface EntityUpdatePayload {
  name?: string;
  subtype?: string;
  content?: Record<string, unknown>;
  tags?: string[];
}

const BASE = '/api/kb/entities';

export async function fetchEntities(
  subtype?: string,
  query?: string,
): Promise<EntityRecord[]> {
  const params = new URLSearchParams();
  if (subtype) params.set('subtype', subtype);
  if (query) params.set('q', query);
  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

export async function fetchEntity(id: string): Promise<EntityRecord> {
  const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

export async function createEntityApi(
  payload: EntityCreatePayload,
): Promise<EntityRecord> {
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

export async function updateEntityApi(
  id: string,
  payload: EntityUpdatePayload,
): Promise<EntityRecord> {
  const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

export async function deleteEntityApi(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
}
