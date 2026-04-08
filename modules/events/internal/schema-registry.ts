/** Contract: contracts/events/rules.md */
import type { Pool } from 'pg';
import type { EventType } from '../contract.ts';

/** Register an event type with its owner module. Throws if already owned by another module. */
export async function registerType(
  pool: Pool,
  type: EventType,
  ownerModule: string,
): Promise<void> {
  const existing = await pool.query(
    'SELECT owner_module FROM event_type_registry WHERE type = $1',
    [type],
  );
  if (existing.rows.length > 0) {
    const currentOwner = (existing.rows[0] as { owner_module: string }).owner_module;
    if (currentOwner !== ownerModule) {
      throw new Error(
        `Event type '${type}' is already registered by module '${currentOwner}', cannot register from '${ownerModule}'`,
      );
    }
    return; // Already registered by same owner
  }
  await pool.query(
    'INSERT INTO event_type_registry (type, owner_module) VALUES ($1, $2)',
    [type, ownerModule],
  );
}

/** Get the owner module for an event type. Returns null if unregistered. */
export async function getOwner(
  pool: Pool,
  type: EventType,
): Promise<string | null> {
  const result = await pool.query(
    'SELECT owner_module FROM event_type_registry WHERE type = $1',
    [type],
  );
  if (result.rows.length === 0) return null;
  return (result.rows[0] as { owner_module: string }).owner_module;
}
