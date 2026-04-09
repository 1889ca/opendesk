/** Contract: contracts/kb/rules.md */

/** A map of entry IDs to their version numbers at capture time. */
export type EntryVersionMap = Record<string, number>;

/** A KB snapshot — immutable timestamped slice of published entry versions. */
export interface KBSnapshot {
  id: string;
  workspaceId: string;
  purpose: string;
  capturedBy: string;
  capturedAt: Date;
  entryVersions: EntryVersionMap;
}

/** A resolved entry from a snapshot with its version-specific data. */
export interface SnapshotEntry {
  entryId: string;
  version: number;
  title: string;
  metadata: Record<string, unknown>;
  tags: string[];
}
