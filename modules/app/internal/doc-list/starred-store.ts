/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';

let cache: Set<string> = new Set();

export async function initStarredCache(): Promise<void> {
  try {
    const res = await apiFetch('/api/starred');
    if (!res.ok) return;
    const items: Array<{ id: string }> = await res.json();
    cache = new Set(items.map((i) => i.id));
  } catch {
    cache = new Set();
  }
}

export function getStarred(): Set<string> {
  return cache;
}

export async function toggleStar(id: string): Promise<void> {
  if (cache.has(id)) {
    cache.delete(id);
    try {
      await apiFetch('/api/starred/' + encodeURIComponent(id), { method: 'DELETE' });
    } catch {
      cache.add(id); // rollback on failure
    }
  } else {
    cache.add(id);
    try {
      await apiFetch('/api/starred/' + encodeURIComponent(id), { method: 'POST' });
    } catch {
      cache.delete(id); // rollback on failure
    }
  }
}
