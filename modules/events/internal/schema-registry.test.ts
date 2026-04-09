/** Contract: contracts/events/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerType, getOwner } from './schema-registry.ts';
import type { EventType } from '../contract.ts';
import { describeIntegration } from '../../../tests/integration/test-pg.ts';

// Issue #127: this test used to mock pg.Pool with a vi.fn() query
// recorder. The integration version exercises the real
// event_type_registry table from migration 003.

// Test-only event types. The EventType enum at the contract layer is
// closed to production types; the registry table doesn't constrain the
// `type` column at the schema level, so casting is safe and keeps test
// fixtures from polluting production type names.
const T_REGISTERED = 'TestRegistry/DocumentUpdated' as EventType;
const T_FOO = 'TestRegistry/Foo' as EventType;
const T_NEVER = 'TestRegistry/NeverRegistered' as EventType;

describeIntegration('schema-registry (integration)', (ctx) => {
  beforeEach(async () => {
    if (!ctx.pool) return;
    // Each test starts with an empty registry. Use a unique prefix
    // so we don't collide with real fixtures elsewhere in the suite.
    await ctx.pool.query(
      "DELETE FROM event_type_registry WHERE type LIKE 'TestRegistry/%'",
    );
  });

  describe('registerType', () => {
    it('inserts a new event type with its owner module', async () => {
      if (!ctx.pool) return;

      await registerType(ctx.pool, T_REGISTERED, 'collab');

      const owner = await getOwner(ctx.pool, T_REGISTERED);
      expect(owner).toBe('collab');
    });

    it('allows re-registration by the same owner module (idempotent)', async () => {
      if (!ctx.pool) return;

      await registerType(ctx.pool, T_REGISTERED, 'collab');
      await expect(
        registerType(ctx.pool, T_REGISTERED, 'collab'),
      ).resolves.not.toThrow();

      const { rows } = await ctx.pool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM event_type_registry WHERE type = $1',
        [T_REGISTERED],
      );
      expect(rows[0].count).toBe('1');
    });

    it('rejects registration by a different owner module', async () => {
      if (!ctx.pool) return;

      await registerType(ctx.pool, T_REGISTERED, 'collab');

      await expect(
        registerType(ctx.pool, T_REGISTERED, 'sharing'),
      ).rejects.toThrow(/already registered by module 'collab'/);
    });
  });

  describe('getOwner', () => {
    it('returns the owner module for a registered type', async () => {
      if (!ctx.pool) return;

      await registerType(ctx.pool, T_FOO, 'audit');

      const owner = await getOwner(ctx.pool, T_FOO);
      expect(owner).toBe('audit');
    });

    it('returns null for an unregistered type', async () => {
      if (!ctx.pool) return;

      const owner = await getOwner(ctx.pool, T_NEVER);
      expect(owner).toBeNull();
    });
  });
});
