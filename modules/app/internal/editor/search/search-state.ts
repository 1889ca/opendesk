/** Contract: contracts/app/rules.md */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface SearchState {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  useRegex: boolean;
  currentMatchIndex: number;
}

export interface MatchRange {
  from: number;
  to: number;
}

export function createInitialState(): SearchState {
  return {
    searchTerm: '',
    replaceTerm: '',
    caseSensitive: false,
    useRegex: false,
    currentMatchIndex: 0,
  };
}

/** Clamp index to valid range; returns 0 if total is 0. */
export function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

/** Escape special regex chars for literal matching. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Check for potentially catastrophic regex patterns (nested quantifiers). */
function hasNestedQuantifiers(pattern: string): boolean {
  return /\([^)]*[+*]\)[+*?]/.test(pattern);
}

/** Build a regex from the search state. */
function buildSearchRegex(search: SearchState): RegExp | null {
  if (!search.searchTerm) return null;

  const flags = search.caseSensitive ? 'g' : 'gi';
  try {
    const pattern = search.useRegex
      ? search.searchTerm
      : escapeRegex(search.searchTerm);

    if (search.useRegex && hasNestedQuantifiers(pattern)) {
      return null;
    }

    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * Find all text matches in the document.
 * Walks through each text node and applies the regex.
 */
export function findMatches(
  doc: ProseMirrorNode,
  search: SearchState,
): MatchRange[] {
  const regex = buildSearchRegex(search);
  if (!regex) return [];

  const matches: MatchRange[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(node.text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      matches.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
      });
    }
  });

  return matches;
}
