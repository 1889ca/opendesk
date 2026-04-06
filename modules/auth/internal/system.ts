/** Contract: contracts/auth/rules.md */

import type { Principal } from '../contract.ts';

/**
 * Creates a system principal for internal/automated operations.
 * actorType is always 'system' per the contract.
 */
export function createSystemPrincipal(
  id = 'system',
  scopes: string[] = ['*'],
): Principal {
  return Object.freeze({
    id,
    actorType: 'system' as const,
    displayName: 'System',
    scopes: Object.freeze([...scopes]) as unknown as string[],
  });
}
