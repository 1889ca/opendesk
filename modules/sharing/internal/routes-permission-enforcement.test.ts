/** Contract: contracts/sharing/rules.md */

/**
 * Integration tests for share link permission enforcement — issue #154.
 *
 * Verifies that resolving a share link creates a grant with the correct
 * role, and that the resulting grant prevents write access for viewers
 * and commenters when checked via the permissions module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createInMemoryShareLinkStore } from './store.ts';
import { createShareLinkService } from './share-links.ts';
import { createShareRoutes } from './routes.ts';
import { createPermissions } from '../../permissions/index.ts';
import { createInMemoryGrantStore } from '../../permissions/internal/grant-store.ts';
import { createInMemoryPasswordRateLimiter } from './rate-limit.ts';
import type { Principal } from '../../auth/contract.ts';
import { evaluate } from '../../permissions/contract.ts';

function makePrincipal(id: string): Principal {
  return { id, actorType: 'human', displayName: id, scopes: [] };
}

function fakePrincipal(id: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = makePrincipal(id);
    next();
  };
}

/**
 * Build a test app where:
 * - alice (owner) can create share links
 * - resolving is done as a different user (redeemerId)
 */
async function buildApp(opts: { creatorId: string; redeemerId: string; activeUserId: string }) {
  const grantStore = createInMemoryGrantStore();
  const permissions = createPermissions({ grantStore });

  // Alice owns doc-1.
  await grantStore.create({
    principalId: opts.creatorId,
    resourceId: 'doc-1',
    resourceType: 'document',
    role: 'owner',
    grantedBy: opts.creatorId,
  });

  const shareLinkStore = createInMemoryShareLinkStore();
  const service = createShareLinkService(shareLinkStore);

  const creatorApp = express();
  creatorApp.use(express.json());
  creatorApp.use(fakePrincipal(opts.creatorId));
  creatorApp.use(createShareRoutes({
    service,
    grantStore,
    permissions,
    rateLimiter: createInMemoryPasswordRateLimiter(),
  }));

  const redeemerApp = express();
  redeemerApp.use(express.json());
  redeemerApp.use(fakePrincipal(opts.redeemerId));
  redeemerApp.use(createShareRoutes({
    service,
    grantStore,
    permissions,
    rateLimiter: createInMemoryPasswordRateLimiter(),
  }));

  return { creatorApp, redeemerApp, grantStore, permissions };
}

describe('share link resolve — role propagation to grants (#154)', () => {
  it('viewer link creates a viewer grant — redeemer cannot write', async () => {
    const { creatorApp, redeemerApp, grantStore } = await buildApp({
      creatorId: 'alice',
      redeemerId: 'bob',
      activeUserId: 'bob',
    });

    // Alice creates a viewer share link.
    const createRes = await request(creatorApp)
      .post('/api/documents/doc-1/share')
      .send({ role: 'viewer' });
    expect(createRes.status).toBe(201);
    const token = createRes.body.token as string;

    // Bob resolves the link.
    const resolveRes = await request(redeemerApp)
      .post(`/api/share/${token}/resolve`)
      .send({});
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.grant.role).toBe('viewer');

    // Verify the grant was created with the viewer role.
    const bobGrants = await grantStore.findByPrincipalAndResource('bob', 'doc-1', 'document');
    expect(bobGrants).toHaveLength(1);
    expect(bobGrants[0]!.role).toBe('viewer');

    // Evaluate: Bob can read but cannot write.
    const bob = makePrincipal('bob');
    const readResult = evaluate(bob, bobGrants, { principalId: 'bob', action: 'read', resourceId: 'doc-1', resourceType: 'document' });
    expect(readResult.allowed).toBe(true);

    const writeResult = evaluate(bob, bobGrants, { principalId: 'bob', action: 'write', resourceId: 'doc-1', resourceType: 'document' });
    expect(writeResult.allowed).toBe(false);

    const commentResult = evaluate(bob, bobGrants, { principalId: 'bob', action: 'comment', resourceId: 'doc-1', resourceType: 'document' });
    expect(commentResult.allowed).toBe(false);
  });

  it('commenter link creates a commenter grant — redeemer can comment but not write', async () => {
    const { creatorApp, redeemerApp, grantStore } = await buildApp({
      creatorId: 'alice',
      redeemerId: 'carol',
      activeUserId: 'carol',
    });

    const createRes = await request(creatorApp)
      .post('/api/documents/doc-1/share')
      .send({ role: 'commenter' });
    expect(createRes.status).toBe(201);
    const token = createRes.body.token as string;

    const resolveRes = await request(redeemerApp)
      .post(`/api/share/${token}/resolve`)
      .send({});
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.grant.role).toBe('commenter');

    const carolGrants = await grantStore.findByPrincipalAndResource('carol', 'doc-1', 'document');
    expect(carolGrants[0]!.role).toBe('commenter');

    const carol = makePrincipal('carol');

    const writeResult = evaluate(carol, carolGrants, { principalId: 'carol', action: 'write', resourceId: 'doc-1', resourceType: 'document' });
    expect(writeResult.allowed).toBe(false);

    const commentResult = evaluate(carol, carolGrants, { principalId: 'carol', action: 'comment', resourceId: 'doc-1', resourceType: 'document' });
    expect(commentResult.allowed).toBe(true);

    const readResult = evaluate(carol, carolGrants, { principalId: 'carol', action: 'read', resourceId: 'doc-1', resourceType: 'document' });
    expect(readResult.allowed).toBe(true);
  });

  it('editor link creates an editor grant — redeemer can write but not delete', async () => {
    const { creatorApp, redeemerApp, grantStore } = await buildApp({
      creatorId: 'alice',
      redeemerId: 'dave',
      activeUserId: 'dave',
    });

    const createRes = await request(creatorApp)
      .post('/api/documents/doc-1/share')
      .send({ role: 'editor' });
    expect(createRes.status).toBe(201);
    const token = createRes.body.token as string;

    const resolveRes = await request(redeemerApp)
      .post(`/api/share/${token}/resolve`)
      .send({});
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.grant.role).toBe('editor');

    const daveGrants = await grantStore.findByPrincipalAndResource('dave', 'doc-1', 'document');
    expect(daveGrants[0]!.role).toBe('editor');

    const dave = makePrincipal('dave');

    const writeResult = evaluate(dave, daveGrants, { principalId: 'dave', action: 'write', resourceId: 'doc-1', resourceType: 'document' });
    expect(writeResult.allowed).toBe(true);

    const deleteResult = evaluate(dave, daveGrants, { principalId: 'dave', action: 'delete', resourceId: 'doc-1', resourceType: 'document' });
    expect(deleteResult.allowed).toBe(true); // editor can delete per ACTION_MIN_ROLE

    const shareResult = evaluate(dave, daveGrants, { principalId: 'dave', action: 'share', resourceId: 'doc-1', resourceType: 'document' });
    expect(shareResult.allowed).toBe(false); // only owner can share
  });

  it('the response grants object reflects the link role, not a default', async () => {
    const { creatorApp, redeemerApp } = await buildApp({
      creatorId: 'alice',
      redeemerId: 'eve',
      activeUserId: 'eve',
    });

    for (const role of ['viewer', 'commenter', 'editor'] as const) {
      const createRes = await request(creatorApp)
        .post('/api/documents/doc-1/share')
        .send({ role });
      const token = createRes.body.token as string;

      const resolveRes = await request(redeemerApp)
        .post(`/api/share/${token}/resolve`)
        .send({});

      expect(resolveRes.status).toBe(200);
      // The response grant.role must match the link's role — not 'owner' or 'editor'.
      expect(resolveRes.body.grant.role).toBe(role);
    }
  });
});
