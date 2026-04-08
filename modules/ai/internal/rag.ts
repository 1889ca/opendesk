/** Contract: contracts/ai/rules.md */
import type {
  ModelProvider,
  RagQueryOptions,
  SemanticSearchResult,
  SourceType,
} from '../contract.ts';
import { RAG_CORPUS_FILTER } from '../contract.ts';
import { searchSimilar } from './vector-store.ts';
import type { Pool } from 'pg';
import { pool as defaultPool } from '../../storage/internal/pool.ts';

/**
 * Get source IDs of published KB entries in allowed corpus partitions.
 * Only 'knowledge' and 'reference' corpus entries feed RAG.
 */
async function getEligibleKbSourceIds(
  workspaceId: string,
  pg: Pool = defaultPool,
): Promise<string[]> {
  const result = await pg.query<{ id: string }>(
    `SELECT id FROM kb_entries
     WHERE workspace_id = $1
       AND lifecycle = 'published'
       AND corpus = ANY($2)`,
    [workspaceId, RAG_CORPUS_FILTER],
  );
  return result.rows.map((r) => r.id);
}

/**
 * Execute a RAG query: embed the question, search vectors, apply
 * corpus filtering, boost KB results, and return ranked context.
 */
export async function ragQuery(
  provider: ModelProvider,
  options: RagQueryOptions,
  pg: Pool = defaultPool,
): Promise<SemanticSearchResult[]> {
  const {
    workspaceId,
    query,
    limit,
    kbBoostFactor,
    includeDocuments,
    includeKb,
  } = options;

  // Determine which source types to include
  const sourceTypes: SourceType[] = [];
  if (includeDocuments) sourceTypes.push('document');
  if (includeKb) sourceTypes.push('kb-entry');

  if (sourceTypes.length === 0) return [];

  // Embed the query
  const queryEmbedding = await provider.embed(query);

  // Fetch raw similarity results
  const rawResults = await searchSimilar(
    queryEmbedding,
    workspaceId,
    { sourceTypes, limit: limit * 2 }, // over-fetch to allow filtering
    pg,
  );

  // Filter KB results to eligible entries (published + correct corpus)
  let eligibleKbIds: Set<string> | null = null;
  if (includeKb) {
    const ids = await getEligibleKbSourceIds(workspaceId, pg);
    eligibleKbIds = new Set(ids);
  }

  const filtered = rawResults.filter((r) => {
    if (r.sourceType === 'kb-entry' && eligibleKbIds) {
      return eligibleKbIds.has(r.sourceId);
    }
    return true;
  });

  // Apply KB boost factor
  const boosted = filtered.map((r) => {
    if (r.sourceType === 'kb-entry') {
      return {
        ...r,
        similarity: Math.min(r.similarity * kbBoostFactor, 1.0),
        metadata: { ...r.metadata, kbBoosted: true },
      };
    }
    return r;
  });

  // Sort by boosted similarity and take limit
  return boosted
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Full RAG pipeline: query vectors, build context string,
 * generate answer via the model provider.
 */
export async function ragAnswer(
  provider: ModelProvider,
  options: RagQueryOptions,
  pg: Pool = defaultPool,
): Promise<{ answer: string; sources: SemanticSearchResult[] }> {
  const sources = await ragQuery(provider, options, pg);

  if (sources.length === 0) {
    const answer = await provider.generate(options.query);
    return { answer, sources: [] };
  }

  const context = sources
    .map((s, i) => `[${i + 1}] (${s.sourceType}): ${s.chunkText}`)
    .join('\n\n');

  const answer = await provider.generate(options.query, context);
  return { answer, sources };
}
