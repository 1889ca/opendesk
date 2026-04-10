/** Contract: contracts/kb/rules.md */
import type { ResolvedReference, KbVersionRef } from '../contract.ts';
export { parseKbUri, buildKbUri } from '../contract.ts';
import type { KbEntryStore } from './pg-entries.ts';
import type { KbVersionStore } from './pg-versions.ts';

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
 * Resolve a version reference to its content.
 * - Pinned (numeric): returns that exact version's content.
 * - Latest: returns the current published entry's latest version.
 *
 * For "latest" resolution, the entry must be published.
 * For pinned resolution, any status is allowed (historical data).
 */
export async function resolveReference(
  ref: KbVersionRef,
  entryStore: KbEntryStore,
  versionStore: KbVersionStore,
): Promise<ResolveResult> {
  const entry = await entryStore.getEntry(ref.entryId);
  if (!entry) {
    return { ok: false, code: 'ENTRY_NOT_FOUND', message: 'KB entry not found' };
  }

  if (ref.version === 'latest') {
    if (entry.status !== 'published') {
      return { ok: false, code: 'NOT_PUBLISHED', message: 'Entry is not published' };
    }
    const ver = await versionStore.getLatestVersion(ref.entryId);
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
  const ver = await versionStore.getVersion(ref.entryId, ref.version);
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
