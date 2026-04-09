/** Contract: contracts/kb/rules.md */
import type { ResolvedReference, KbVersionRef } from '../contract.ts';
import { getEntry } from './pg-entries.ts';
import { getVersion, getLatestVersion } from './pg-versions.ts';

export interface ResolveError {
  ok: false;
  code: 'ENTRY_NOT_FOUND' | 'VERSION_NOT_FOUND' | 'NOT_PUBLISHED';
  message: string;
}

export interface ResolveSuccess {
  ok: true;
  data: ResolvedReference;
}

export type ResolveResult = ResolveSuccess | ResolveError;

/**
 * Parse a kb:// URI into a version reference.
 * Format: kb://entry-uuid@v7 or kb://entry-uuid@latest
 */
export function parseKbUri(uri: string): KbVersionRef | null {
  const match = uri.match(/^kb:\/\/([0-9a-f-]{36})@(v(\d+)|latest)$/);
  if (!match) return null;
  const entryId = match[1];
  if (match[2] === 'latest') {
    return { entryId, version: 'latest' };
  }
  return { entryId, version: parseInt(match[3], 10) };
}

/**
 * Build a kb:// URI from a version reference.
 */
export function buildKbUri(ref: KbVersionRef): string {
  const versionPart = ref.version === 'latest' ? 'latest' : `v${ref.version}`;
  return `kb://${ref.entryId}@${versionPart}`;
}

/**
 * Resolve a version reference to its content.
 * - Pinned (numeric): returns that exact version's content.
 * - Latest: returns the current published entry's latest version.
 *
 * For "latest" resolution, the entry must be published.
 * For pinned resolution, any status is allowed (historical data).
 */
export async function resolveReference(ref: KbVersionRef): Promise<ResolveResult> {
  const entry = await getEntry(ref.entryId);
  if (!entry) {
    return { ok: false, code: 'ENTRY_NOT_FOUND', message: 'KB entry not found' };
  }

  if (ref.version === 'latest') {
    if (entry.status !== 'published') {
      return { ok: false, code: 'NOT_PUBLISHED', message: 'Entry is not published' };
    }
    const ver = await getLatestVersion(ref.entryId);
    if (!ver) {
      return { ok: false, code: 'VERSION_NOT_FOUND', message: 'No versions found' };
    }
    return {
      ok: true,
      data: {
        entryId: ref.entryId,
        version: ver.version,
        title: ver.title,
        body: ver.body,
        status: entry.status,
        resolvedAt: new Date().toISOString(),
      },
    };
  }

  // Pinned version -- resolve regardless of current status
  const ver = await getVersion(ref.entryId, ref.version);
  if (!ver) {
    return { ok: false, code: 'VERSION_NOT_FOUND', message: `Version ${ref.version} not found` };
  }
  return {
    ok: true,
    data: {
      entryId: ref.entryId,
      version: ver.version,
      title: ver.title,
      body: ver.body,
      status: entry.status,
      resolvedAt: new Date().toISOString(),
    },
  };
}
