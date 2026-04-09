/** Contract: contracts/app-kb/rules.md */

import { fetchEntry, fetchRelationships, type KBEntryRecord, type KBRelationshipRecord } from './kb-api.ts';

export interface GraphNode {
  id: string;
  title: string;
  entryType: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationType: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Convert a KBEntryRecord to a GraphNode. */
function toNode(entry: KBEntryRecord): GraphNode {
  return { id: entry.id, title: entry.title, entryType: entry.entryType };
}

/** Convert a KBRelationshipRecord to a GraphEdge. */
function toEdge(rel: KBRelationshipRecord): GraphEdge {
  return { source: rel.sourceId, target: rel.targetId, relationType: rel.relationType };
}

/** Deduplicate edges by source+target+relationType. */
function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.source}:${e.target}:${e.relationType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fetch graph data centered on an entry, expanding to the given depth.
 * Depth 1 = direct neighbors only. Depth 2 = neighbors of neighbors, etc.
 */
export async function fetchGraphData(entryId: string, depth = 1): Promise<GraphData> {
  const nodeMap = new Map<string, GraphNode>();
  const allEdges: GraphEdge[] = [];
  const visited = new Set<string>();
  let frontier = [entryId];

  for (let d = 0; d <= depth && frontier.length > 0; d++) {
    const nextFrontier: string[] = [];

    const fetches = frontier.filter((id) => !visited.has(id)).map(async (id) => {
      visited.add(id);

      // Fetch the entry itself if not already known
      if (!nodeMap.has(id)) {
        try {
          const entry = await fetchEntry(id);
          nodeMap.set(id, toNode(entry));
        } catch {
          nodeMap.set(id, { id, title: id.slice(0, 8), entryType: 'unknown' });
        }
      }

      // Don't fetch relationships beyond the requested depth
      if (d >= depth) return;

      const rels = await fetchRelationships(id, 'both');
      for (const rel of rels) {
        allEdges.push(toEdge(rel));
        const neighborId = rel.sourceId === id ? rel.targetId : rel.sourceId;
        if (!visited.has(neighborId)) nextFrontier.push(neighborId);
      }
    });

    await Promise.all(fetches);
    frontier = [...new Set(nextFrontier)];
  }

  // Fetch any neighbor entries we discovered but haven't loaded yet
  const missingIds = frontier.filter((id) => !nodeMap.has(id));
  await Promise.all(
    missingIds.map(async (id) => {
      try {
        const entry = await fetchEntry(id);
        nodeMap.set(id, toNode(entry));
      } catch {
        nodeMap.set(id, { id, title: id.slice(0, 8), entryType: 'unknown' });
      }
    }),
  );

  return {
    nodes: Array.from(nodeMap.values()),
    edges: dedupeEdges(allEdges),
  };
}
