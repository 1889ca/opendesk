/** Contract: contracts/kb/rules.md */
import type { EntitySubtype } from '../contract.ts';
import {
  contentSchemaForSubtype,
} from '../contract.ts';

/**
 * Validate entity content against the subtype-specific schema.
 * Returns the parsed content on success, or throws a ZodError on failure.
 */
export function validateContent(
  subtype: EntitySubtype,
  content: Record<string, unknown>,
): Record<string, unknown> {
  const schema = contentSchemaForSubtype(subtype);
  return schema.parse(content) as Record<string, unknown>;
}

/**
 * Safe version that returns a result object instead of throwing.
 */
export function validateContentSafe(
  subtype: EntitySubtype,
  content: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const schema = contentSchemaForSubtype(subtype);
  const result = schema.safeParse(content);
  if (result.success) {
    return { ok: true, data: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
}
