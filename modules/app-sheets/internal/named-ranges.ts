/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';

export interface NamedRange {
  name: string;
  sheetId: string;
  range: string;
}

const STORE_KEY = 'named-ranges';

function getMap(ydoc: Y.Doc): Y.Map<string> {
  return ydoc.getMap<string>(STORE_KEY);
}

/** Serialize a NamedRange to a JSON string for Yjs storage. */
function serialize(nr: NamedRange): string {
  return JSON.stringify({ sheetId: nr.sheetId, range: nr.range });
}

/** Deserialize a stored entry back to NamedRange. */
function deserialize(name: string, raw: string): NamedRange | null {
  try {
    const parsed = JSON.parse(raw) as { sheetId: string; range: string };
    if (!parsed.sheetId || !parsed.range) return null;
    return { name, sheetId: parsed.sheetId, range: parsed.range };
  } catch {
    return null;
  }
}

/** Validate a named range identifier (Excel-compatible rules). */
export function isValidName(name: string): boolean {
  // Must start with letter or underscore, contain only word chars, no spaces
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) && name.length <= 255;
}

/** Define (create or update) a named range. Returns false if name is invalid. */
export function defineNamedRange(ydoc: Y.Doc, nr: NamedRange): boolean {
  if (!isValidName(nr.name)) return false;
  ydoc.transact(() => {
    getMap(ydoc).set(nr.name, serialize(nr));
  });
  return true;
}

/** Update an existing named range. Same as define — upsert semantics. */
export function updateNamedRange(ydoc: Y.Doc, nr: NamedRange): boolean {
  return defineNamedRange(ydoc, nr);
}

/** Delete a named range by name. */
export function deleteNamedRange(ydoc: Y.Doc, name: string): void {
  ydoc.transact(() => {
    getMap(ydoc).delete(name);
  });
}

/** Get all named ranges. */
export function getNamedRanges(ydoc: Y.Doc): NamedRange[] {
  const map = getMap(ydoc);
  const result: NamedRange[] = [];
  map.forEach((val, key) => {
    const nr = deserialize(key, val);
    if (nr) result.push(nr);
  });
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a name to its NamedRange, or null if not found. */
export function resolveNamedRange(ydoc: Y.Doc, name: string): NamedRange | null {
  const raw = getMap(ydoc).get(name);
  if (!raw) return null;
  return deserialize(name, raw);
}

/** Observe changes to the named range map. */
export function observeNamedRanges(ydoc: Y.Doc, callback: () => void): () => void {
  const map = getMap(ydoc);
  map.observe(callback);
  return () => map.unobserve(callback);
}
