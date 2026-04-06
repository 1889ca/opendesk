/** Contract: contracts/document/rules.md */
import { type TextDocumentSnapshot, type Migration, TextSchemaVersion, TextDocumentSnapshotSchema } from '../contract.ts';

const migrations: Migration[] = [
  // Add migrations here as schema versions are added:
  // { from: '1.0.0', to: '1.1.0', up: (s) => ({ ...s, schemaVersion: '1.1.0' }) },
];

export function migrateToLatest(snapshot: TextDocumentSnapshot): TextDocumentSnapshot {
  let current = snapshot;

  if (current.schemaVersion === TextSchemaVersion.current) {
    return current;
  }

  const versionChain = buildMigrationChain(current.schemaVersion);
  for (const migration of versionChain) {
    current = migration.up(current);
  }

  TextDocumentSnapshotSchema.parse(current);
  return current;
}

function buildMigrationChain(from: string): Migration[] {
  const chain: Migration[] = [];
  let version = from;

  while (version !== TextSchemaVersion.current) {
    const next = migrations.find((m) => m.from === version);
    if (!next) {
      throw new Error(`No migration from version ${version}`);
    }
    chain.push(next);
    version = next.to;
  }

  return chain;
}
