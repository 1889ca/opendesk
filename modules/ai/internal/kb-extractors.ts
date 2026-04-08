/** Contract: contracts/ai/rules.md */
import type { TextExtractor } from '../contract.ts';
import type { KbEntry } from '../../kb/contract.ts';
import { registerExtractor } from './extractors.ts';

// --- KB Reference Extractor ---
// Extracts: title + authors + abstract

export const kbReferenceExtractor: TextExtractor<KbEntry> = (entry) => {
  const parts: string[] = [entry.title];
  const content = entry.content as {
    authors?: Array<{ given?: string; family?: string; literal?: string }>;
    abstract?: string | null;
    metadata?: Record<string, unknown>;
  };

  if (content.authors && content.authors.length > 0) {
    const authorNames = content.authors
      .map((a) => a.literal || [a.given, a.family].filter(Boolean).join(' '))
      .filter(Boolean);
    if (authorNames.length > 0) {
      parts.push(`Authors: ${authorNames.join(', ')}`);
    }
  }

  if (content.abstract) {
    parts.push(content.abstract);
  }

  return parts.join('\n');
};

// --- KB Entity Extractor ---
// Extracts: name + description + metadata fields

export const kbEntityExtractor: TextExtractor<KbEntry> = (entry) => {
  const parts: string[] = [entry.title];
  const content = entry.content as {
    description: string;
    metadata?: Record<string, unknown>;
  };

  parts.push(content.description);

  if (content.metadata) {
    const metaText = Object.entries(content.metadata)
      .map(([key, val]) => `${key}: ${String(val)}`)
      .join(', ');
    if (metaText) parts.push(metaText);
  }

  return parts.join('\n');
};

// --- KB Dataset Extractor ---
// Extracts: column names + summary statistics + description

export const kbDatasetExtractor: TextExtractor<KbEntry> = (entry) => {
  const parts: string[] = [entry.title];
  const content = entry.content as {
    description: string;
    columns?: Array<{ name: string; dataType: string; description?: string }>;
    summary?: string | null;
  };

  parts.push(content.description);

  if (content.columns && content.columns.length > 0) {
    const colDesc = content.columns
      .map((c) => `${c.name} (${c.dataType})${c.description ? ': ' + c.description : ''}`)
      .join(', ');
    parts.push(`Columns: ${colDesc}`);
  }

  if (content.summary) {
    parts.push(`Summary: ${content.summary}`);
  }

  return parts.join('\n');
};

// --- KB Note Extractor ---
// Extracts: full text content

export const kbNoteExtractor: TextExtractor<KbEntry> = (entry) => {
  const parts: string[] = [entry.title];
  const content = entry.content as { content: string };
  parts.push(content.content);
  return parts.join('\n');
};

// --- KB Glossary Extractor ---
// Extracts: term + definition

export const kbGlossaryExtractor: TextExtractor<KbEntry> = (entry) => {
  const content = entry.content as { term: string; definition: string };
  return `${content.term}: ${content.definition}`;
};

// --- Register all KB extractors ---

registerExtractor('kb-reference', kbReferenceExtractor);
registerExtractor('kb-entity', kbEntityExtractor);
registerExtractor('kb-dataset', kbDatasetExtractor);
registerExtractor('kb-note', kbNoteExtractor);
registerExtractor('kb-glossary', kbGlossaryExtractor);
