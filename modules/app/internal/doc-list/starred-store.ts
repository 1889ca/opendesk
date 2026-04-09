/** Contract: contracts/app/rules.md */

/** Persists starred document IDs in localStorage (issue #184). */

const KEY = 'opendesk-starred-docs';

export function getStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function toggleStar(id: string): void {
  const starred = getStarred();
  if (starred.has(id)) { starred.delete(id); } else { starred.add(id); }
  localStorage.setItem(KEY, JSON.stringify([...starred]));
}
