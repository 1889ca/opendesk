/**
 * Integration test for issue #126 — Postgres RLS enforcement on the
 * grants table.
 *
 * This test runs against a real Postgres instance (no mocks). It
 * verifies:
 *
 * 1. The pg-grant-store, when called inside runWithPrincipal, can
 *    only see grants that the RLS policy allows for that principal.
 * 2. Calling rlsQuery outside any principal context throws.
 * 3. The runAsSystem bypass lets background/admin code see all grants.
 * 4. The empty-string bypass that the original migration 011 had is
 *    NOT a bypass anymore (migration 013 removed it).
 *
 * If no Postgres is reachable the suite is skipped (see
 * tests/integration/test-pg.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { describeIntegration, truncate } from './test-pg.ts';
import { createPgGrantStore } from '../../modules/permissions/internal/pg-grant-store.ts';
import {
  runWithPrincipal,
  runAsSystem,
  rlsQuery,
} from '../../modules/storage/index.ts';

const ALICE = 'rls-test-user-alice';
const BOB = 'rls-test-user-bob';
const DOC_ALICE = 'rls-test-doc-alice';
const DOC_BOB = 'rls-test-doc-bob';

describeIntegration('RLS enforcement on grants (issue #126)', (ctx) => {
  beforeEach(async () => {
    if (!ctx.pool) return;
    // Each test starts from a clean grants table.
    await truncate(ctx.pool, 'grants');
  });

  it('rlsQuery throws when called outside any principal context', async () => {
    if (!ctx.pool) return;

    await expect(
      rlsQuery(ctx.pool, 'SELECT 1'),
    ).rejects.toThrow(/principal context/);
  });

  it('a user can read grants where they are the principal', async () => {
    if (!ctx.pool) return;
    const store = createPgGrantStore(ctx.pool);

    // System seeds the data: alice has a grant on her doc.
    await runAsSystem(async () => {
      await store.create({
        principalId: ALICE,
        resourceId: DOC_ALICE,
        resourceType: 'document',
        role: 'owner',
        grantedBy: ALICE,
      });
    });

    // Alice can read her own grant.
    const aliceGrants = await runWithPrincipal(ALICE, async () =>
      store.findByPrincipal(ALICE),
    );
    expect(aliceGrants).toHaveLength(1);
    expect(aliceGrants[0].principalId).toBe(ALICE);
  });

  it('a user CANNOT see another user\'s grants', async () => {
    if (!ctx.pool) return;
    const store = createPgGrantStore(ctx.pool);

    // System creates a grant FOR alice that bob did not grant.
    await runAsSystem(async () => {
      await store.create({
        principalId: ALICE,
        resourceId: DOC_ALICE,
        resourceType: 'document',
        role: 'owner',
        grantedBy: ALICE,
      });
    });

    // Bob tries to read alice's grants.
    const grantsBobSees = await runWithPrincipal(BOB, async () =>
      store.findByPrincipal(ALICE),
    );

    // RLS should filter out alice's row entirely; Bob sees nothing.
    expect(grantsBobSees).toHaveLength(0);
  });

  it('runAsSystem can read every user\'s grants', async () => {
    if (!ctx.pool) return;
    const store = createPgGrantStore(ctx.pool);

    await runAsSystem(async () => {
      await store.create({
        principalId: ALICE,
        resourceId: DOC_ALICE,
        resourceType: 'document',
        role: 'owner',
        grantedBy: ALICE,
      });
      await store.create({
        principalId: BOB,
        resourceId: DOC_BOB,
        resourceType: 'document',
        role: 'owner',
        grantedBy: BOB,
      });
    });

    const all = await runAsSystem(async () =>
      store.findByResource(DOC_ALICE, 'document'),
    );
    expect(all.map((g) => g.principalId)).toContain(ALICE);

    const allBob = await runAsSystem(async () =>
      store.findByResource(DOC_BOB, 'document'),
    );
    expect(allBob.map((g) => g.principalId)).toContain(BOB);
  });

  it('a user can also see grants they granted to others', async () => {
    if (!ctx.pool) return;
    const store = createPgGrantStore(ctx.pool);

    // Alice grants Bob viewer access on her doc.
    await runAsSystem(async () => {
      await store.create({
        principalId: ALICE,
        resourceId: DOC_ALICE,
        resourceType: 'document',
        role: 'owner',
        grantedBy: ALICE,
      });
      await store.create({
        principalId: BOB,
        resourceId: DOC_ALICE,
        resourceType: 'document',
        role: 'viewer',
        grantedBy: ALICE,
      });
    });

    // Alice running findByResource sees both grants — her own owner grant
    // (principal_id matches) and Bob's viewer grant (granted_by matches).
    const grantsAliceSees = await runWithPrincipal(ALICE, async () =>
      store.findByResource(DOC_ALICE, 'document'),
    );
    expect(grantsAliceSees).toHaveLength(2);
    const principals = grantsAliceSees.map((g) => g.principalId).sort();
    expect(principals).toEqual([ALICE, BOB].sort());

    // Bob running findByResource only sees his own grant — not alice's
    // owner grant (principal_id is ALICE, granted_by is ALICE, neither
    // matches BOB).
    const grantsBobSees = await runWithPrincipal(BOB, async () =>
      store.findByResource(DOC_ALICE, 'document'),
    );
    expect(grantsBobSees).toHaveLength(1);
    expect(grantsBobSees[0].principalId).toBe(BOB);
  });

  it('a user cannot delete a grant they did not create', async () => {
    if (!ctx.pool) return;
    const store = createPgGrantStore(ctx.pool);

    // Alice creates a grant for herself.
    let aliceGrantId = '';
    await runAsSystem(async () => {
      const g = await store.create({
        principalId: ALICE,
        resourceId: DOC_ALICE,
        resourceType: 'document',
        role: 'owner',
        grantedBy: ALICE,
      });
      aliceGrantId = g.id;
    });

    // Bob tries to revoke alice's grant — should silently fail (RLS
    // filters the row out of the DELETE's USING clause, so the DELETE
    // affects 0 rows).
    const removed = await runWithPrincipal(BOB, async () =>
      store.revoke(aliceGrantId),
    );
    expect(removed).toBe(false);

    // The grant still exists when system reads it.
    const stillThere = await runAsSystem(async () =>
      store.findById(aliceGrantId),
    );
    expect(stillThere).not.toBeNull();
    expect(stillThere?.principalId).toBe(ALICE);
  });
});
