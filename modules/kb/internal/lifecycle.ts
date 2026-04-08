/** Contract: contracts/kb/rules.md */
import { STATUS_TRANSITIONS, type KbEntryStatus } from '../contract.ts';

export interface TransitionError {
  ok: false;
  code: 'INVALID_TRANSITION' | 'ENTRY_NOT_FOUND';
  message: string;
}

export interface TransitionSuccess {
  ok: true;
  from: KbEntryStatus;
  to: KbEntryStatus;
}

export type TransitionResult = TransitionSuccess | TransitionError;

/**
 * Validate whether a status transition is allowed.
 * Pure function -- no side effects.
 */
export function validateTransition(
  from: KbEntryStatus,
  to: KbEntryStatus,
): TransitionResult {
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `Cannot transition from "${from}" to "${to}". Allowed: [${allowed.join(', ')}]`,
    };
  }
  return { ok: true, from, to };
}

/**
 * Check if an entry is available for public consumption
 * (RAG extraction, citation insertion, federation).
 */
export function isPubliclyAvailable(status: KbEntryStatus): boolean {
  return status === 'published';
}
