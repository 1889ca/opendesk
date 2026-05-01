/** Contract: contracts/api/rules.md — SSE routes security tests */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Grant, GrantDef } from '../../permissions/index.ts';
import type { GrantStore } from '../../permissions/internal/grant-store.ts';
import { createSseFanout, type SseFanout } from './sse-fanout.ts';
import { createSSERoutes } from './sse-routes.ts';
import type { DomainEvent } from '../../events/contract.ts';

// ---------------------------------------------------------------------------
// Minimal test doubles (real in-memory, no mocks)
// ---------------------------------------------------------------------------

class StubGrantStore implements GrantStore {
  constructor(private grants: Grant[] = []) {}
  async findByPrincipal(id: string) { return this.grants.filter((g) => g.principalId === id); }
  async findByPrincipalAndResource(p: string, r: string, t: string) {
    return this.grants.filter((g) => g.principalId === p && g.resourceId === r && g.resourceType === t);
  }
  async findByResource(r: string, t: string) {
    return this.grants.filter((g) => g.resourceId === r && g.resourceType === t);
  }
  async create(def: GrantDef): Promise<Grant> {
    const g: Grant = { ...def, id: `g-${Date.now()}`, grantedAt: new Date().toISOString() };
    this.grants.push(g);
    return g;
  }
  async revoke(id: string) {
    const i = this.grants.findIndex((g) => g.id === id);
    if (i === -1) return false;
    this.grants.splice(i, 1);
    return true;
  }
  async findById(id: string) { return this.grants.find((g) => g.id === id) ?? null; }
  async deleteByResource(r: string, t: string) {
    const before = this.grants.length;
    this.grants = this.grants.filter((g) => !(g.resourceId === r && g.resourceType === t));
    return before - this.grants.length;
  }
}

class SseResponse {
  written: string[] = [];
  ended = false;
  _headers: Record<string, string> = {};
  _status = 200;
  _body: unknown;
  statusCode = 200;
  setHeader(k: string, v: string) { this._headers[k] = v; return this; }
  getHeader(k: string) { return this._headers[k]; }
  flushHeaders() { /* no-op */ }
  write(c: string) { this.written.push(c); return true; }
  end() { this.ended = true; }
  status(code: number) { this._status = code; this.statusCode = code; return this; }
  json(data: unknown) { this._body = data; return this; }
}

class SseRequest {
  principal: { id: string } | undefined;
  private close: Array<() => void> = [];
  constructor(pid?: string) { this.principal = pid ? { id: pid } : undefined; }
  on(ev: string, fn: () => void) { if (ev === 'close') this.close.push(fn); }
  simulateClose() { for (const f of this.close) f(); }
}

function makeGrant(overrides: Partial<Grant>): Grant {
  return { id: 'g1', principalId: 'alice', resourceId: 'doc-1', resourceType: 'document',
    role: 'editor', grantedBy: 'admin', grantedAt: new Date().toISOString(), ...overrides };
}

function makeEvent(overrides: Partial<DomainEvent>): DomainEvent {
  return { id: `e-${Math.random()}`, type: 'DocumentUpdated', aggregateId: 'doc-1',
    actorId: 'admin', actorType: 'human', occurredAt: new Date().toISOString(), ...overrides };
}

async function openStream(fanout: SseFanout, store: GrantStore, pid: string) {
  const router = createSSERoutes(fanout, store);
  const layer = (router as unknown as { stack: Array<{ route?: { path: string; stack: Array<{ handle: Function }> } }> })
    .stack.find((l) => l.route?.path === '/events/stream');
  const handler = layer!.route!.stack[0].handle as (req: Request, res: Response) => Promise<void>;
  const req = new SseRequest(pid);
  const res = new SseResponse();
  await handler(req as unknown as Request, res as unknown as Response);
  return { req, res };
}

// ---------------------------------------------------------------------------
// Tests — #506: Grant IDOR filter
// ---------------------------------------------------------------------------

describe('SSE #506: Grant events filtered by principal', () => {
  let fanout: SseFanout;
  beforeEach(() => { fanout = createSseFanout(); });

  it('forwards GrantCreated to grantee (revisionId match)', async () => {
    const { res } = await openStream(fanout, new StubGrantStore(), 'alice');
    fanout.emit(makeEvent({ type: 'GrantCreated', aggregateId: 'doc-99', actorId: 'admin', revisionId: 'alice' }));
    expect(res.written.join('')).toContain('GrantCreated');
  });

  it('forwards GrantCreated to granter (actorId match)', async () => {
    const { res } = await openStream(fanout, new StubGrantStore(), 'admin');
    fanout.emit(makeEvent({ type: 'GrantCreated', aggregateId: 'doc-99', actorId: 'admin', revisionId: 'alice' }));
    expect(res.written.join('')).toContain('GrantCreated');
  });

  it('blocks GrantCreated from unrelated principal', async () => {
    const { res } = await openStream(fanout, new StubGrantStore(), 'bob');
    fanout.emit(makeEvent({ type: 'GrantCreated', aggregateId: 'doc-99', actorId: 'admin', revisionId: 'alice' }));
    expect(res.written.join('')).not.toContain('GrantCreated');
  });

  it('blocks GrantRevoked from unrelated principal', async () => {
    const { res } = await openStream(fanout, new StubGrantStore(), 'charlie');
    fanout.emit(makeEvent({ type: 'GrantRevoked', aggregateId: 'doc-1', actorId: 'admin', revisionId: 'alice' }));
    expect(res.written.join('')).not.toContain('GrantRevoked');
  });
});

// ---------------------------------------------------------------------------
// Tests — #507: allowedDocIds refreshed on grant changes
// ---------------------------------------------------------------------------

describe('SSE #507: allowedDocIds updated dynamically', () => {
  let fanout: SseFanout;
  beforeEach(() => { fanout = createSseFanout(); });

  it('adds docId on GrantCreated for self', async () => {
    const { res } = await openStream(fanout, new StubGrantStore(), 'alice');
    fanout.emit(makeEvent({ type: 'DocumentUpdated', aggregateId: 'doc-new' }));
    expect(res.written.filter((w) => w.includes('DocumentUpdated'))).toHaveLength(0);
    fanout.emit(makeEvent({ type: 'GrantCreated', aggregateId: 'doc-new', actorId: 'admin', revisionId: 'alice' }));
    fanout.emit(makeEvent({ type: 'DocumentUpdated', aggregateId: 'doc-new' }));
    expect(res.written.filter((w) => w.includes('DocumentUpdated'))).toHaveLength(1);
  });

  it('removes docId on GrantRevoked for self and closes stream', async () => {
    const { res } = await openStream(fanout, new StubGrantStore([makeGrant({ principalId: 'alice' })]), 'alice');
    fanout.emit(makeEvent({ type: 'DocumentUpdated', aggregateId: 'doc-1' }));
    expect(res.written.filter((w) => w.includes('DocumentUpdated'))).toHaveLength(1);
    fanout.emit(makeEvent({ type: 'GrantRevoked', aggregateId: 'doc-1', actorId: 'admin', revisionId: 'alice' }));
    expect(res.ended).toBe(true);
    expect(res.written.filter((w) => w.includes('GrantRevoked'))).toHaveLength(1);
  });

  it('blocks document events for docs alice never had access to', async () => {
    const { res } = await openStream(fanout, new StubGrantStore([makeGrant({ principalId: 'alice' })]), 'alice');
    fanout.emit(makeEvent({ type: 'DocumentUpdated', aggregateId: 'doc-secret' }));
    expect(res.written.filter((w) => w.includes('DocumentUpdated'))).toHaveLength(0);
  });

  it('cleans up fanout subscription on client disconnect', async () => {
    const { req } = await openStream(fanout, new StubGrantStore(), 'alice');
    expect(fanout.listenerCount()).toBe(1);
    req.simulateClose();
    expect(fanout.listenerCount()).toBe(0);
  });

  it('returns 401 for unauthenticated request', async () => {
    const router = createSSERoutes(createSseFanout(), new StubGrantStore());
    const layer = (router as unknown as { stack: Array<{ route?: { path: string; stack: Array<{ handle: Function }> } }> })
      .stack.find((l) => l.route?.path === '/events/stream');
    const handler = layer!.route!.stack[0].handle as (req: Request, res: Response) => Promise<void>;
    const req = new SseRequest();
    const res = new SseResponse();
    await handler(req as unknown as Request, res as unknown as Response);
    expect(res._status).toBe(401);
  });
});
