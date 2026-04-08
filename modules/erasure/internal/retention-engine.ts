/** Contract: contracts/erasure/rules.md */

import type { Pool } from 'pg';
import type {
  RetentionPolicy,
  PrunePreview,
  PruneResult,
  ErasureAttestation,
} from '../contract.ts';
import { createAttestation } from './attestation.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('erasure:retention');

type MatchedEntry = { id: string; type: string; age: number; title?: string };

/**
 * Fetch all retention policies.
 */
export async function listPolicies(pool: Pool): Promise<RetentionPolicy[]> {
  const result = await pool.query(
    `SELECT * FROM retention_policies ORDER BY created_at DESC`,
  );
  return result.rows.map(mapPolicyRow);
}

/**
 * Upsert a retention policy (insert or update on conflict).
 */
export async function upsertPolicy(
  pool: Pool,
  policy: RetentionPolicy,
): Promise<RetentionPolicy> {
  await pool.query(
    `INSERT INTO retention_policies (id, name, target, max_age_days, enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       target = EXCLUDED.target,
       max_age_days = EXCLUDED.max_age_days,
       enabled = EXCLUDED.enabled,
       updated_at = EXCLUDED.updated_at`,
    [policy.id, policy.name, policy.target, policy.maxAgeDays, policy.enabled, policy.createdAt, policy.updatedAt],
  );
  return policy;
}

/**
 * Find entries matching a retention policy's criteria.
 */
export async function findMatchingEntries(
  pool: Pool,
  policy: RetentionPolicy,
): Promise<MatchedEntry[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - policy.maxAgeDays);

  const targetTable = getTargetTable(policy.target);
  const result = await pool.query(
    `SELECT id, '${policy.target}' as type,
            EXTRACT(DAY FROM NOW() - created_at)::int as age,
            COALESCE(title, name, id::text) as title
     FROM ${targetTable}
     WHERE created_at < $1
     ORDER BY created_at ASC`,
    [cutoffDate.toISOString()],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    type: String(row.type),
    age: Number(row.age),
    title: row.title ? String(row.title) : undefined,
  }));
}

/**
 * Preview what a retention policy would prune (dry-run mode).
 */
export async function previewPrune(
  pool: Pool,
  policyId: string,
): Promise<PrunePreview> {
  const policy = await getPolicyById(pool, policyId);
  if (!policy) throw new Error(`Retention policy ${policyId} not found`);

  const matched = await findMatchingEntries(pool, policy);

  return {
    policyId,
    matchedEntries: matched,
    wouldDelete: matched.length,
    dryRun: true as const,
  };
}

/**
 * Execute a retention policy prune with attestation generation.
 */
export async function executePrune(
  pool: Pool,
  hmacSecret: string,
  policyId: string,
  requestedBy: string,
): Promise<PruneResult> {
  const policy = await getPolicyById(pool, policyId);
  if (!policy) throw new Error(`Retention policy ${policyId} not found`);
  if (!policy.enabled) throw new Error(`Retention policy ${policyId} is disabled`);

  const matched = await findMatchingEntries(pool, policy);
  const attestations: ErasureAttestation[] = [];

  log.info('executing retention prune', {
    policyId,
    policyName: policy.name,
    matchedCount: matched.length,
  });

  const targetTable = getTargetTable(policy.target);
  for (const entry of matched) {
    await pool.query(`DELETE FROM ${targetTable} WHERE id = $1`, [entry.id]);

    const attestation = await createAttestation(
      pool,
      hmacSecret,
      entry.id,
      'retention_prune',
      requestedBy,
      `Retention policy: ${policy.name} (max ${policy.maxAgeDays} days)`,
      `Pruned ${entry.type} entry "${entry.title}" (age: ${entry.age} days)`,
    );
    attestations.push(attestation);
  }

  log.info('retention prune completed', {
    policyId,
    deleted: matched.length,
    attestations: attestations.length,
  });

  return {
    policyId,
    deleted: matched.length,
    attestations,
    dryRun: false as const,
  };
}

async function getPolicyById(
  pool: Pool,
  policyId: string,
): Promise<RetentionPolicy | null> {
  const result = await pool.query(
    `SELECT * FROM retention_policies WHERE id = $1`,
    [policyId],
  );
  if (result.rows.length === 0) return null;
  return mapPolicyRow(result.rows[0]);
}

function getTargetTable(target: string): string {
  const tables: Record<string, string> = {
    kb_draft: 'kb_entries',
    kb_published: 'kb_entries',
    document_draft: 'documents',
    tombstone: 'erasure_attestations',
  };
  return tables[target] ?? 'documents';
}

function mapPolicyRow(row: Record<string, unknown>): RetentionPolicy {
  return {
    id: String(row.id),
    name: String(row.name),
    target: String(row.target) as RetentionPolicy['target'],
    maxAgeDays: Number(row.max_age_days),
    enabled: Boolean(row.enabled),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
