/** Contract: contracts/document/rules.md */
import {
  type TextDocumentSnapshot,
  type SpreadsheetDocumentSnapshot,
  type PresentationDocumentSnapshot,
  type DocumentSnapshot,
  type Migration,
  TextSchemaVersion,
  TextDocumentSnapshotSchema,
  SpreadsheetSchemaVersion,
  SpreadsheetDocumentSnapshotSchema,
  PresentationSchemaVersion,
  PresentationDocumentSnapshotSchema,
} from '../contract/index.ts';

// --- Per-type migration registries ---

const textMigrations: Migration<TextDocumentSnapshot>[] = [
  // { from: '1.0.0', to: '1.1.0', up: (s) => ({ ...s, schemaVersion: '1.1.0' }) },
];

const spreadsheetMigrations: Migration<SpreadsheetDocumentSnapshot>[] = [];

const presentationMigrations: Migration<PresentationDocumentSnapshot>[] = [];

// --- Generic migration chain builder ---

function buildChain<T>(migrations: Migration<T>[], from: string, target: string): Migration<T>[] {
  const chain: Migration<T>[] = [];
  let version = from;

  while (version !== target) {
    const next = migrations.find((m) => m.from === version);
    if (!next) {
      throw new Error(`No migration from version ${version}`);
    }
    chain.push(next);
    version = next.to;
  }

  return chain;
}

// --- Per-type migrate functions ---

function migrateText(snapshot: TextDocumentSnapshot): TextDocumentSnapshot {
  if (snapshot.schemaVersion === TextSchemaVersion.current) return snapshot;
  let current = snapshot;
  for (const m of buildChain(textMigrations, current.schemaVersion, TextSchemaVersion.current)) {
    current = m.up(current);
  }
  TextDocumentSnapshotSchema.parse(current);
  return current;
}

function migrateSpreadsheet(snapshot: SpreadsheetDocumentSnapshot): SpreadsheetDocumentSnapshot {
  if (snapshot.schemaVersion === SpreadsheetSchemaVersion.current) return snapshot;
  let current = snapshot;
  const chain = buildChain(spreadsheetMigrations, current.schemaVersion, SpreadsheetSchemaVersion.current);
  for (const m of chain) {
    current = m.up(current);
  }
  SpreadsheetDocumentSnapshotSchema.parse(current);
  return current;
}

function migratePresentation(snapshot: PresentationDocumentSnapshot): PresentationDocumentSnapshot {
  if (snapshot.schemaVersion === PresentationSchemaVersion.current) return snapshot;
  let current = snapshot;
  const chain = buildChain(presentationMigrations, current.schemaVersion, PresentationSchemaVersion.current);
  for (const m of chain) {
    current = m.up(current);
  }
  PresentationDocumentSnapshotSchema.parse(current);
  return current;
}

// --- Unified dispatcher ---

export function migrateToLatest(snapshot: DocumentSnapshot): DocumentSnapshot {
  switch (snapshot.documentType) {
    case 'text':
      return migrateText(snapshot);
    case 'spreadsheet':
      return migrateSpreadsheet(snapshot);
    case 'presentation':
      return migratePresentation(snapshot);
  }
}
